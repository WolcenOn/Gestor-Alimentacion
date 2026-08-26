import { formatMoney } from "./utils.js";
import { canonicalForPackIngredient } from "./services/canonicalPackBridge.js";
import { getCanonicalIngredientProducts, isPricesApiConfigured, pickBestIngredientProduct } from "./services/pricesApi.js";
import { ingredientConsumedCost } from "./services/dishPricing.js";

const productCache = new Map();
const TERMINAL = new Set(["loaded", "unconfigured", "error"]);

export function parsePreviewIngredientText(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(.+?):\s*([0-9]+(?:[.,][0-9]+)?)\s*(g|kg|ml|l|unidades?)$/i);
  if (!match) return null;
  return {
    name: match[1].trim(),
    amount: Number(match[2].replace(",", ".")),
    unit: match[3].toLowerCase() === "unidad" ? "unidades" : match[3].toLowerCase()
  };
}

export function summarizeCanonicalCoverage(lines = []) {
  const parsed = (Array.isArray(lines) ? lines : []).map(line => typeof line === "string" ? parsePreviewIngredientText(line) : line).filter(Boolean);
  const canonical = parsed.map(line => ({ line, canonical: canonicalForPackIngredient({ name: line.name }) })).filter(item => item.canonical);
  return {
    total: parsed.length,
    canonical: canonical.length,
    complete: parsed.length > 0 && canonical.length === parsed.length,
    requirements: canonical.map(item => ({
      canonicalIngredientId: item.canonical.id,
      canonicalIngredientName: item.canonical.name,
      amount: item.line.amount,
      unit: item.line.unit
    }))
  };
}

function cachedBestProduct(canonicalIngredientId) {
  const key = String(canonicalIngredientId || "").trim();
  if (!key) return Promise.resolve(null);
  if (!productCache.has(key)) {
    const request = getCanonicalIngredientProducts({ ingredientId: key })
      .then(payload => pickBestIngredientProduct(payload?.items || [])?.product || null)
      .catch(error => {
        productCache.delete(key);
        throw error;
      });
    productCache.set(key, request);
  }
  return productCache.get(key);
}

async function priceRequirements(requirements = []) {
  let total = 0;
  let priced = 0;
  let approximate = false;
  for (const requirement of requirements) {
    const product = await cachedBestProduct(requirement.canonicalIngredientId);
    const cost = ingredientConsumedCost(requirement, product);
    if (cost == null) continue;
    total += cost;
    priced += 1;
    if (product?.variableWeight === true) approximate = true;
  }
  return { total, priced, approximate };
}

function ensureInfoNode(card, selector, datasetKey) {
  let node = card.querySelector(selector);
  if (node) return node;
  node = document.createElement("div");
  node.className = "small price-source-card pack-canonical-info";
  node.dataset[datasetKey] = "true";
  const details = card.querySelector("details");
  if (details) card.insertBefore(node, details);
  else card.appendChild(node);
  return node;
}

function renderCoverage(node, coverage, price = null) {
  const coverageText = coverage.total
    ? `${coverage.canonical}/${coverage.total} ingredientes enlazados a Prices API`
    : "Sin ingredientes detectables";
  const priceText = price && price.priced > 0
    ? `${coverage.complete && price.priced === coverage.total && !price.approximate ? "" : "≈ "}${formatMoney(price.total)} / ración`
    : "Precio por ración pendiente";
  node.innerHTML = `
    <strong>${priceText}</strong>
    <p class="qty-line">${coverageText}</p>
    ${coverage.complete ? "" : `<p class="small muted">El importe es parcial mientras falten ingredientes canónicos o precios disponibles.</p>`}
  `;
}

async function hydratePreviewCard(card) {
  if (TERMINAL.has(card.dataset.canonicalInfoStatus) || card.dataset.canonicalInfoStatus === "loading") return;
  const modal = card.closest("#modalRoot, .modal-root");
  const heading = modal?.querySelector("header .muted")?.textContent || "";
  const isCanonical = /canonical/i.test(heading);
  if (!isCanonical) return;

  const lines = [...card.querySelectorAll(".preview-columns > div:first-child li")].map(li => li.textContent || "");
  const coverage = summarizeCanonicalCoverage(lines);
  const node = ensureInfoNode(card, "[data-pack-preview-canonical-info]", "packPreviewCanonicalInfo");
  if (!isPricesApiConfigured()) {
    card.dataset.canonicalInfoStatus = "unconfigured";
    renderCoverage(node, coverage, null);
    return;
  }

  card.dataset.canonicalInfoStatus = "loading";
  node.innerHTML = `<strong>Calculando precio por ración...</strong><p class="qty-line">${coverage.canonical}/${coverage.total} ingredientes enlazados a Prices API</p>`;
  try {
    const price = await priceRequirements(coverage.requirements);
    if (!card.isConnected) return;
    card.dataset.canonicalInfoStatus = "loaded";
    renderCoverage(node, coverage, price);
  } catch (error) {
    if (!card.isConnected) return;
    card.dataset.canonicalInfoStatus = "error";
    renderCoverage(node, coverage, null);
    console.warn("No se pudo calcular el precio del pack previsualizado", error);
  }
}

function installedDishCoverage(state, dish) {
  const ingredients = new Map((state.ingredients || []).map(ingredient => [ingredient.id, ingredient]));
  const lines = (dish?.recipe || []).map(line => {
    const ingredient = ingredients.get(line.ingredientId);
    return {
      name: ingredient?.name || line.ingredientId,
      amount: Number(line.qty || 0),
      unit: line.unit || ingredient?.unit || "g",
      canonicalIngredientId: ingredient?.canonicalIngredientId || ""
    };
  });
  const canonical = lines.filter(line => line.canonicalIngredientId);
  return { total: lines.length, canonical: canonical.length, complete: lines.length > 0 && canonical.length === lines.length };
}

function decorateInstalledPacks(root, state) {
  root.querySelectorAll(".installed-pack-item").forEach(card => {
    const packId = String(card.querySelector('[data-action="confirm-delete-pack"]')?.dataset?.packId || "").trim();
    if (!packId) return;
    const pack = (state.dishPacks || []).find(item => item.id === packId);
    const canonicalPack = (pack?.tags || []).some(tag => /canonical|prices-api/i.test(String(tag))) || /_canonical$/.test(packId);
    if (!canonicalPack) return;

    const title = card.querySelector(".pack-title-text strong");
    if (title && !card.querySelector("[data-installed-canonical-badge]")) {
      const badge = document.createElement("span");
      badge.className = "badge success";
      badge.dataset.installedCanonicalBadge = "true";
      badge.textContent = "Canonical · Prices API";
      title.insertAdjacentElement("afterend", badge);
    }

    const dishes = (state.dishes || []).filter(dish => dish.packId === packId);
    [...card.querySelectorAll(".pack-installed-dish-list > li")].forEach((row, index) => {
      const dish = dishes[index];
      if (!dish || row.querySelector("[data-installed-canonical-coverage]")) return;
      const coverage = installedDishCoverage(state, dish);
      const note = document.createElement("small");
      note.className = "muted";
      note.dataset.installedCanonicalCoverage = "true";
      note.textContent = `${coverage.canonical}/${coverage.total} ingredientes enlazados a Prices API`;
      row.appendChild(note);
    });
  });
}

export async function hydratePackPricingUi(root = document) {
  if (!root?.querySelectorAll) return;
  const { getState } = await import("./store.js");
  const state = getState();
  decorateInstalledPacks(root, state);
  root.querySelectorAll(".pack-dish-preview").forEach(card => void hydratePreviewCard(card));
}

function schedule() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => void hydratePackPricingUi(document), 0);
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  schedule();
  const observer = new MutationObserver(schedule);
  const viewRoot = document.getElementById("viewRoot");
  const modalRoot = document.getElementById("modalRoot");
  if (viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
  if (modalRoot) observer.observe(modalRoot, { childList: true, subtree: true });
}
