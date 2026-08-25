import { getState } from "./store.js";
import { computeShoppingListWithProgress } from "./state/shoppingProgress.js";
import { quoteCanonicalIngredient, isPricesApiConfigured } from "./services/pricesApi.js";
import { escapeHtml, formatMoney } from "./utils.js";

const quoteCache = new Map();

export function pickBestShoppingQuote(items = []) {
  const candidates = (Array.isArray(items) ? items : [])
    .filter(item => item?.product && item.product.available !== false && Number(item.totalCost) > 0);
  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const costDiff = Number(a.totalCost) - Number(b.totalCost);
    if (costDiff) return costDiff;
    const packageDiff = Number(a.packageCount || 0) - Number(b.packageCount || 0);
    if (packageDiff) return packageDiff;
    return String(a.product.name || "").localeCompare(String(b.product.name || ""), "es");
  })[0];
}

export function summarizeShoppingQuote(quote) {
  const product = quote?.product;
  if (!product) return null;
  const packageCount = Number(quote.packageCount || 0);
  const packagePrice = Number(product.price || 0);
  const totalCost = Number(quote.totalCost || 0);
  if (!(packageCount > 0) || !(packagePrice > 0) || !(totalCost > 0)) return null;

  return {
    productName: String(product.name || "Producto supermercado"),
    supermarket: String(product.supermarketId || "supermercado").toUpperCase(),
    packageCount,
    packagePrice,
    totalCost,
    purchasedAmount: Number(quote.purchasedAmount || 0),
    purchasedUnit: String(quote.purchasedUnit || ""),
    wasteAmount: Number(quote.wasteAmount || 0)
  };
}

function renderQuote(quote) {
  const summary = summarizeShoppingQuote(quote);
  if (!summary) return `<p class="small muted">Sin cotización de supermercado disponible.</p>`;
  const purchaseText = summary.purchasedAmount > 0 && summary.purchasedUnit
    ? `${summary.purchasedAmount.toLocaleString("es-ES", { maximumFractionDigits: 3 })} ${escapeHtml(summary.purchasedUnit)} comprados`
    : "";
  const wasteText = summary.wasteAmount > 0 && summary.purchasedUnit
    ? ` · sobra ${summary.wasteAmount.toLocaleString("es-ES", { maximumFractionDigits: 3 })} ${escapeHtml(summary.purchasedUnit)}`
    : "";

  return `
    <div class="small price-source-card shopping-supermarket-quote">
      <strong>${escapeHtml(summary.supermarket)} · ${escapeHtml(summary.productName)}</strong>
      <p class="qty-line">${summary.packageCount} envase(s) × ${formatMoney(summary.packagePrice)} = <strong>${formatMoney(summary.totalCost)}</strong></p>
      ${purchaseText ? `<p class="small muted">${purchaseText}${wasteText}</p>` : ""}
    </div>`;
}

function quoteKey(ingredientId, amount, unit) {
  return `${ingredientId}|${amount}|${unit}`;
}

function cachedQuote(params) {
  const key = quoteKey(params.ingredientId, params.amount, params.unit);
  if (!quoteCache.has(key)) {
    const request = quoteCanonicalIngredient(params).catch(error => {
      quoteCache.delete(key);
      throw error;
    });
    quoteCache.set(key, request);
  }
  return quoteCache.get(key);
}

async function hydrateQuoteNode(node, ingredient, shoppingItem) {
  if (!node || node.dataset.quoteStatus === "loading" || node.dataset.quoteStatus === "loaded") return;
  if (!ingredient?.canonicalIngredientId || !(Number(shoppingItem?.remainingQty) > 0)) return;

  if (!isPricesApiConfigured()) {
    node.dataset.quoteStatus = "unconfigured";
    node.innerHTML = `<p class="small muted">Precio supermercado no configurado.</p>`;
    return;
  }

  node.dataset.quoteStatus = "loading";
  node.innerHTML = `<p class="small muted">Calculando compra DIA...</p>`;
  try {
    const payload = await cachedQuote({
      ingredientId: ingredient.canonicalIngredientId,
      amount: shoppingItem.remainingQty,
      unit: shoppingItem.unit
    });
    const best = pickBestShoppingQuote(payload?.items || []);
    if (!node.isConnected) return;
    node.dataset.quoteStatus = "loaded";
    node.innerHTML = renderQuote(best);
  } catch (error) {
    if (!node.isConnected) return;
    node.dataset.quoteStatus = "error";
    node.innerHTML = `<p class="small muted">Precio DIA no disponible ahora.</p>`;
    console.warn("No se pudo cotizar la línea de compra", ingredient.id, error);
  }
}

export function hydrateShoppingSupermarketQuotes(root = document) {
  if (!root?.querySelectorAll) return;
  const state = getState();
  const shoppingItems = new Map(computeShoppingListWithProgress(state).map(item => [item.ingredientId, item]));
  const ingredients = new Map((state.ingredients || []).map(ingredient => [ingredient.id, ingredient]));

  root.querySelectorAll("article.shopping-item").forEach(card => {
    const ingredientButton = card.querySelector("[data-ingredient-id]");
    const ingredientId = String(ingredientButton?.dataset?.ingredientId || "").trim();
    const ingredient = ingredients.get(ingredientId);
    const shoppingItem = shoppingItems.get(ingredientId);
    if (!ingredient?.canonicalIngredientId || !(Number(shoppingItem?.remainingQty) > 0)) return;

    let node = card.querySelector("[data-shopping-supermarket-quote]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.shoppingSupermarketQuote = "true";
      const actions = card.querySelector(".compact-shopping-actions");
      if (actions) card.insertBefore(node, actions);
      else card.appendChild(node);
    }
    void hydrateQuoteNode(node, ingredient, shoppingItem);
  });
}

function scheduleHydration() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => hydrateShoppingSupermarketQuotes(document), 0);
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  scheduleHydration();
  const viewRoot = document.getElementById("viewRoot");
  if (viewRoot) {
    const observer = new MutationObserver(scheduleHydration);
    observer.observe(viewRoot, { childList: true, subtree: true });
  }
}
