import { getState } from "./store.js";
import { computeShoppingListWithProgress } from "./state/shoppingProgress.js";
import { directPurchaseSubtotal, directPurchasesForWeek } from "./state/directPurchases.js";
import { quoteCanonicalIngredient, isPricesApiConfigured } from "./services/pricesApi.js";
import { canStartShoppingQuote, pickBestShoppingQuote, summarizeShoppingQuote } from "./services/shoppingQuotes.js";
import { escapeHtml, formatMoney } from "./utils.js";

const quoteCache = new Map();

function renderQuote(quote) {
  const summary = summarizeShoppingQuote(quote);
  if (!summary) return `<p class="small muted">Sin cotización de supermercado disponible.</p>`;

  const approximatePrefix = summary.approximate ? "≈ " : "";
  const purchaseText = summary.purchasedAmount > 0 && summary.purchasedUnit
    ? `${approximatePrefix}${summary.purchasedAmount.toLocaleString("es-ES", { maximumFractionDigits: 3 })} ${escapeHtml(summary.purchasedUnit)} comprados`
    : "";
  const wasteText = summary.wasteAmount > 0 && summary.purchasedUnit
    ? ` · sobra ${summary.approximate ? "aprox. " : ""}${summary.wasteAmount.toLocaleString("es-ES", { maximumFractionDigits: 3 })} ${escapeHtml(summary.purchasedUnit)}`
    : "";
  const costText = `${approximatePrefix}${formatMoney(summary.totalCost)}`;

  let pricingText;
  let detailSuffix = "";
  if (summary.purchaseMode === "variable_weight") {
    pricingText = `${summary.pricePerUnit > 0 ? `${formatMoney(summary.pricePerUnit)} / ${escapeHtml(summary.priceUnit || "unidad")} · ` : ""}precio final según peso real`;
    detailSuffix = " · cantidad y precio aproximados";
  } else if (summary.purchaseMode === "approximate_package") {
    const packageLabel = summary.packageCount === 1 ? "pieza/envase aprox." : "piezas/envases aprox.";
    pricingText = `${summary.packageCount} ${packageLabel} × ${approximatePrefix}${formatMoney(summary.packagePrice)}`;
    detailSuffix = " · peso y precio final pueden variar";
  } else {
    pricingText = `${summary.packageCount} envase(s) × ${formatMoney(summary.packagePrice)}`;
  }

  return `
    <div class="small price-source-card shopping-supermarket-quote">
      <strong>${escapeHtml(summary.supermarket)} · ${escapeHtml(summary.productName)}</strong>
      <p class="qty-line">${pricingText} = <strong>${costText}</strong></p>
      ${purchaseText ? `<p class="small muted">${purchaseText}${wasteText}${detailSuffix}</p>` : ""}
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

function updateWeeklyTotal(root = document) {
  const totalNode = root.querySelector?.("[data-shopping-supermarket-total]");
  if (!totalNode) return;
  const quoteNodes = [...root.querySelectorAll("[data-shopping-supermarket-quote]")];
  const loaded = quoteNodes.filter(node => node.dataset.quoteStatus === "loaded" && Number(node.dataset.quoteTotalCost) > 0);
  const pending = quoteNodes.some(node => node.dataset.quoteStatus === "loading" || !node.dataset.quoteStatus);
  const foodTotal = loaded.reduce((sum, node) => sum + Number(node.dataset.quoteTotalCost || 0), 0);
  const approximate = loaded.some(node => node.dataset.quoteApproximate === "true");
  const state = getState();
  const directItems = directPurchasesForWeek(state);
  const otherTotal = directPurchaseSubtotal(state);
  const grandTotal = foodTotal + otherTotal;

  const foodText = loaded.length
    ? `${approximate ? "≈ " : ""}${formatMoney(foodTotal)} · ${loaded.length} línea(s) cotizada(s)${pending ? " · quedan cotizaciones pendientes" : ""}`
    : pending
      ? "Calculando cotizaciones..."
      : "Sin líneas canónicas cotizables";
  const otherText = `${formatMoney(otherTotal)} · ${directItems.length} producto(s)`;
  const totalPrefix = approximate ? "≈ " : "";

  totalNode.innerHTML = `
    <strong>Resumen de presupuesto</strong>
    <p class="qty-line">Alimentos: <strong>${foodText}</strong></p>
    <p class="qty-line">Otros productos: <strong>${otherText}</strong></p>
    <p class="qty-line">Total compra${pending ? " provisional" : ""}: <strong>${totalPrefix}${formatMoney(grandTotal)}</strong></p>
    ${approximate ? `<p class="small muted">El subtotal de alimentos incluye productos a granel o piezas de peso aproximado: el importe final puede variar.</p>` : ""}`;
}

async function hydrateQuoteNode(node, ingredient, shoppingItem) {
  if (!node || !canStartShoppingQuote(node.dataset.quoteStatus)) return;
  if (!ingredient?.canonicalIngredientId || !(Number(shoppingItem?.remainingQty) > 0)) return;

  if (!isPricesApiConfigured()) {
    node.dataset.quoteStatus = "unconfigured";
    node.innerHTML = `<p class="small muted">Precio supermercado no configurado.</p>`;
    updateWeeklyTotal(document);
    return;
  }

  node.dataset.quoteStatus = "loading";
  node.innerHTML = `<p class="small muted">Calculando compra supermercado...</p>`;
  updateWeeklyTotal(document);
  try {
    const payload = await cachedQuote({
      ingredientId: ingredient.canonicalIngredientId,
      amount: shoppingItem.remainingQty,
      unit: shoppingItem.unit
    });
    const best = pickBestShoppingQuote(payload?.items || []);
    if (!node.isConnected) return;
    const summary = summarizeShoppingQuote(best);
    node.dataset.quoteStatus = "loaded";
    node.dataset.quoteTotalCost = summary ? String(summary.totalCost) : "0";
    node.dataset.quoteApproximate = summary?.approximate ? "true" : "false";
    node.innerHTML = renderQuote(best);
    updateWeeklyTotal(document);
  } catch (error) {
    if (!node.isConnected) return;
    node.dataset.quoteStatus = "error";
    node.dataset.quoteTotalCost = "0";
    node.innerHTML = `<p class="small muted">Precio supermercado no disponible ahora.</p>`;
    updateWeeklyTotal(document);
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
  updateWeeklyTotal(root);
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
