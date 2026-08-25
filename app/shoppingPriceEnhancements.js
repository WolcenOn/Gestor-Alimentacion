import { getState } from "./store.js";
import { computeShoppingListWithProgress } from "./state/shoppingProgress.js";
import { quoteCanonicalIngredient, isPricesApiConfigured } from "./services/pricesApi.js";
import { canStartShoppingQuote, pickBestShoppingQuote, summarizeShoppingQuote } from "./services/shoppingQuotes.js";
import { escapeHtml, formatMoney } from "./utils.js";

const quoteCache = new Map();

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
  if (!node || !canStartShoppingQuote(node.dataset.quoteStatus)) return;
  if (!ingredient?.canonicalIngredientId || !(Number(shoppingItem?.remainingQty) > 0)) return;

  if (!isPricesApiConfigured()) {
    node.dataset.quoteStatus = "unconfigured";
    node.innerHTML = `<p class="small muted">Precio supermercado no configurado.</p>`;
    return;
  }

  node.dataset.quoteStatus = "loading";
  node.innerHTML = `<p class="small muted">Calculando compra supermercado...</p>`;
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
    node.innerHTML = `<p class="small muted">Precio supermercado no disponible ahora.</p>`;
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
