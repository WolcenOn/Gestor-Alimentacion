import { getState } from "./store.js";
import { escapeHtml, formatMoney } from "./utils.js";
import { getCanonicalIngredientProducts, isPricesApiConfigured, pickBestIngredientProduct } from "./services/pricesApi.js";
import { collectCanonicalDishRequirements } from "./services/packPricing.js";
import { summarizeDishConsumedCost } from "./services/dishPricing.js";

const productCache = new Map();
const TERMINAL = new Set(["loaded", "unconfigured", "error"]);

function cachedBestProduct(canonicalIngredientId) {
  if (!productCache.has(canonicalIngredientId)) {
    const request = getCanonicalIngredientProducts({ ingredientId: canonicalIngredientId })
      .then(payload => pickBestIngredientProduct(payload?.items || [])?.product || null)
      .catch(error => {
        productCache.delete(canonicalIngredientId);
        throw error;
      });
    productCache.set(canonicalIngredientId, request);
  }
  return productCache.get(canonicalIngredientId);
}

async function priceRequirements(requirements, totalRecipeLines) {
  const products = new Map();
  await Promise.all(requirements.map(async requirement => {
    const product = await cachedBestProduct(requirement.canonicalIngredientId);
    if (product) products.set(requirement.canonicalIngredientId, product);
  }));
  return summarizeDishConsumedCost(requirements, products, totalRecipeLines);
}

function priceLabel(summary) {
  if (!summary || summary.pricedIngredients === 0) return "Precio por ración pendiente";
  const prefix = summary.complete ? "" : "≈ ";
  const coverage = summary.complete ? "precio completo" : `${summary.pricedIngredients}/${summary.totalIngredients} ingredientes con precio`;
  return `${prefix}${formatMoney(summary.totalCost)} / ración · ${coverage}`;
}

async function hydrateNode(node, requirements, totalRecipeLines) {
  if (!node || TERMINAL.has(node.dataset.priceStatus) || node.dataset.priceStatus === "loading") return;
  if (!isPricesApiConfigured()) {
    node.dataset.priceStatus = "unconfigured";
    node.textContent = "Precio por ración no configurado";
    return;
  }
  if (!requirements.length) {
    node.dataset.priceStatus = "loaded";
    node.textContent = "Precio por ración pendiente · sin ingredientes canónicos";
    return;
  }

  node.dataset.priceStatus = "loading";
  node.textContent = "Calculando precio por ración...";
  try {
    const summary = await priceRequirements(requirements, totalRecipeLines);
    if (!node.isConnected) return;
    node.dataset.priceStatus = "loaded";
    node.textContent = priceLabel(summary);
  } catch (error) {
    if (!node.isConnected) return;
    node.dataset.priceStatus = "error";
    node.textContent = "Precio por ración no disponible ahora";
    console.warn("No se pudo calcular el coste consumido del plato", error);
  }
}

function localDishRequirements(state, dish) {
  const ingredientsById = new Map((state.ingredients || []).map(ingredient => [ingredient.id, ingredient]));
  return collectCanonicalDishRequirements(dish, ingredientsById);
}

export function hydrateConsumedPrices(root = document) {
  if (!root?.querySelectorAll) return;
  const state = getState();
  const dishes = new Map((state.dishes || []).map(dish => [dish.id, dish]));

  root.querySelectorAll(".dish-pill-name[data-dish-id]").forEach(button => {
    const dish = dishes.get(button.dataset.dishId);
    if (!dish) return;
    const pill = button.closest(".dish-pill");
    if (!pill) return;
    let node = pill.querySelector("[data-week-dish-price]");
    if (!node) {
      node = document.createElement("small");
      node.className = "muted";
      node.dataset.weekDishPrice = "true";
      button.insertAdjacentElement("afterend", node);
    }
    void hydrateNode(node, localDishRequirements(state, dish), (dish.recipe || []).length);
  });

  root.querySelectorAll("[data-installed-pack-dish-price]").forEach(item => {
    const dish = dishes.get(item.dataset.installedPackDishPrice);
    const node = item.querySelector("small");
    if (!dish || !node) return;
    void hydrateNode(node, localDishRequirements(state, dish), (dish.recipe || []).length);
  });

  root.querySelectorAll("[data-pack-preview-price]").forEach(card => {
    const node = card.querySelector("[data-pack-preview-price-label]");
    if (!node) return;
    let requirements = [];
    try { requirements = JSON.parse(card.dataset.priceRequirements || "[]"); } catch { requirements = []; }
    const totalRecipeLines = Number(card.dataset.recipeLines || 0);
    void hydrateNode(node, requirements, totalRecipeLines);
  });
}

function schedule() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => hydrateConsumedPrices(document), 0);
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  schedule();
  const observer = new MutationObserver(schedule);
  const viewRoot = document.getElementById("viewRoot");
  const modalRoot = document.getElementById("modalRoot");
  if (viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
  if (modalRoot) observer.observe(modalRoot, { childList: true, subtree: true });
}
