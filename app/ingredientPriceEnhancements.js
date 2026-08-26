import { getState } from "./store.js";
import { getCanonicalIngredientProducts, isPricesApiConfigured, pickBestIngredientProduct } from "./services/pricesApi.js";
import { summarizeUnitPrice } from "./services/supermarketPricing.js";
import { escapeHtml, formatMoney } from "./utils.js";

const productCache = new Map();

function cachedProducts(canonicalIngredientId) {
  const key = String(canonicalIngredientId || "").trim();
  if (!productCache.has(key)) {
    const request = getCanonicalIngredientProducts({ ingredientId: key }).catch(error => {
      productCache.delete(key);
      throw error;
    });
    productCache.set(key, request);
  }
  return productCache.get(key);
}

function renderUnitPrice(product) {
  const summary = summarizeUnitPrice(product);
  if (!summary) return `<p class="small muted">Sin precio unitario de supermercado disponible.</p>`;
  const supermarket = String(product?.supermarketId || "supermercado").toUpperCase();
  const reference = summary.referencePrice > 0
    ? ` · ${formatMoney(summary.referencePrice)} / ${summary.referenceAmount} ${escapeHtml(summary.referenceUnit)}`
    : "";
  return `
    <div class="small price-source-card ingredient-supermarket-unit-price">
      <strong>${escapeHtml(supermarket)} · ${formatMoney(summary.pricePerUnit)} / ${escapeHtml(summary.priceUnit)}</strong>
      <p class="qty-line">${escapeHtml(product?.name || "Producto supermercado")}${reference}</p>
      ${summary.variableWeight ? `<p class="small muted">Producto por peso · cantidad y precio final aproximados.</p>` : ""}
    </div>`;
}

async function hydrateNode(node, ingredient) {
  if (!node || node.dataset.priceStatus) return;
  if (!ingredient?.canonicalIngredientId) return;
  if (!isPricesApiConfigured()) {
    node.dataset.priceStatus = "unconfigured";
    node.innerHTML = `<p class="small muted">Precio supermercado no configurado.</p>`;
    return;
  }
  node.dataset.priceStatus = "loading";
  node.innerHTML = `<p class="small muted">Consultando precio por unidad...</p>`;
  try {
    const payload = await cachedProducts(ingredient.canonicalIngredientId);
    const best = pickBestIngredientProduct(payload?.items || []);
    if (!node.isConnected) return;
    node.dataset.priceStatus = "loaded";
    node.innerHTML = best?.product ? renderUnitPrice(best.product) : `<p class="small muted">Sin precio de supermercado disponible.</p>`;
  } catch (error) {
    if (!node.isConnected) return;
    node.dataset.priceStatus = "error";
    node.innerHTML = `<p class="small muted">Precio supermercado no disponible ahora.</p>`;
    console.warn("No se pudo cargar precio unitario", ingredient.id, error);
  }
}

export function hydrateIngredientUnitPrices(root = document) {
  if (!root?.querySelectorAll) return;
  const state = getState();
  const ingredients = new Map((state.ingredients || []).map(ingredient => [ingredient.id, ingredient]));
  root.querySelectorAll(".ingredient-item[data-ingredient-id]").forEach(card => {
    const ingredient = ingredients.get(card.dataset.ingredientId);
    if (!ingredient?.canonicalIngredientId) return;
    let node = card.querySelector("[data-ingredient-supermarket-unit-price]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.ingredientSupermarketUnitPrice = "true";
      const actions = card.querySelector(".row-actions");
      if (actions) card.insertBefore(node, actions);
      else card.appendChild(node);
    }
    void hydrateNode(node, ingredient);
  });
}

function scheduleHydration() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => hydrateIngredientUnitPrices(document), 0);
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  scheduleHydration();
  const viewRoot = document.getElementById("viewRoot");
  if (viewRoot) {
    const observer = new MutationObserver(scheduleHydration);
    observer.observe(viewRoot, { childList: true, subtree: true });
  }
}
