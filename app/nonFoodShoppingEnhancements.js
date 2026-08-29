import { getState, updateState } from "./store.js";
import { computeShoppingListWithProgress } from "./state/shoppingProgress.js";
import { searchSupermarketProducts, isPricesApiConfigured } from "./services/pricesApi.js";
import { addDirectPurchase, directPurchasesForWeek, removeDirectPurchase, setDirectPurchaseQuantity } from "./state/directPurchases.js";
import { escapeHtml, formatMoney } from "./utils.js";
import { showAlert } from "./render/ui.js";

let searchResults = [];

function renderSearchResult(product, index) {
  const price = Number(product?.price) || 0;
  const packageText = Number(product?.packageAmount) > 0 && product?.packageUnit
    ? ` · ${Number(product.packageAmount).toLocaleString("es-ES", { maximumFractionDigits: 3 })} ${escapeHtml(product.packageUnit)}`
    : "";
  const unitText = Number(product?.pricePerUnit) > 0 && product?.priceUnit
    ? ` · ${formatMoney(Number(product.pricePerUnit))}/${escapeHtml(product.priceUnit)}`
    : "";
  const unavailable = product?.available === false;
  return `
    <article class="item product-result non-food-search-result" data-non-food-result-index="${index}">
      <div class="result-body">
        <strong>${escapeHtml(product?.name || "Producto")}</strong>
        <p class="qty-line">${escapeHtml(String(product?.supermarketId || "supermercado").toUpperCase())}${packageText}</p>
        <p class="small muted">${formatMoney(price)}${unitText}${unavailable ? " · No disponible actualmente" : ""}</p>
        <div class="row-actions">
          <label class="small">Unidades
            <input type="number" min="1" step="1" value="1" data-non-food-result-quantity aria-label="Unidades de ${escapeHtml(product?.name || "producto")}">
          </label>
          <button type="button" data-action="add-direct-purchase" data-index="${index}" ${unavailable ? "disabled" : ""}>Añadir a la compra</button>
        </div>
      </div>
    </article>`;
}

async function searchNonFoodProducts(form) {
  const root = document.getElementById("nonFoodSearchResults");
  if (!root) return;
  const query = String(new FormData(form).get("query") || "").trim();
  if (!query) throw new Error("Escribe un producto para buscar.");
  if (!isPricesApiConfigured()) throw new Error("La API de precios no está configurada.");

  root.innerHTML = `<p class="small muted">Buscando otros productos...</p>`;
  const payload = await searchSupermarketProducts({ query, scope: "non_food" });
  searchResults = Array.isArray(payload?.items) ? payload.items : [];
  root.innerHTML = searchResults.length
    ? searchResults.map(renderSearchResult).join("")
    : `<p class="small muted">No se han encontrado otros productos para “${escapeHtml(query)}”.</p>`;
}

function combinedShoppingText(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const foods = computeShoppingListWithProgress(state)
    .filter(item => item.remainingQty > 0)
    .map(item => `- ${item.name}: ${item.display.remaining}`);
  const others = directPurchasesForWeek(state)
    .map(item => `- ${item.name}: ${Number(item.quantity) || 0} ud. (${formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0))})`);
  return [
    `Lista de la compra · ${week?.name || "Semana"}`,
    "",
    "Alimentos",
    ...(foods.length ? foods : ["- Sin alimentos pendientes"]),
    "",
    "Otros productos",
    ...others
  ].join("\n");
}

async function shareCombinedShopping(state) {
  const text = combinedShoppingText(state);
  if (navigator.share) {
    await navigator.share({ text });
    return;
  }
  await navigator.clipboard?.writeText(text);
  showAlert("Lista copiada al portapapeles.");
}

// The existing main handler shares food-only lists. Intercept in capture phase
// only when direct products exist so the combined list is shared once.
document.addEventListener("click", event => {
  const button = event.target.closest?.('[data-action="share-shopping"]');
  if (!button) return;
  const state = getState();
  if (!directPurchasesForWeek(state).length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void shareCombinedShopping(state).catch(error => {
    console.error(error);
    showAlert(error.message || "No se pudo compartir la lista.", "error");
  });
}, true);

document.addEventListener("submit", async event => {
  const form = event.target.closest?.('form[data-form="non-food-product-search"]');
  if (!form) return;
  event.preventDefault();
  try {
    await searchNonFoodProducts(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo buscar el producto.", "error");
    const root = document.getElementById("nonFoodSearchResults");
    if (root) root.innerHTML = `<p class="small muted">Búsqueda no disponible ahora.</p>`;
  }
});

document.addEventListener("click", event => {
  const button = event.target.closest?.("[data-action]");
  if (!button) return;

  if (button.dataset.action === "add-direct-purchase") {
    const index = Number(button.dataset.index);
    const product = searchResults[index];
    if (!product) return;
    const card = button.closest("[data-non-food-result-index]");
    const quantity = Number(card?.querySelector("[data-non-food-result-quantity]")?.value || 1);
    try {
      updateState(draft => addDirectPurchase(draft, { product, quantity }), "direct-purchase-add");
      showAlert(`${product.name || "Producto"} añadido a Otros productos.`);
    } catch (error) {
      console.error(error);
      showAlert(error.message || "No se pudo añadir el producto.", "error");
    }
  }

  if (button.dataset.action === "remove-direct-purchase") {
    const itemId = String(button.dataset.directPurchaseId || "");
    updateState(draft => removeDirectPurchase(draft, itemId), "direct-purchase-remove");
    showAlert("Producto eliminado de la compra.");
  }
});

document.addEventListener("change", event => {
  const input = event.target.closest?.("[data-direct-purchase-quantity]");
  if (!input) return;
  const itemId = String(input.dataset.directPurchaseId || "");
  try {
    updateState(draft => setDirectPurchaseQuantity(draft, itemId, Number(input.value)), "direct-purchase-quantity");
  } catch (error) {
    console.error(error);
    showAlert(error.message || "Cantidad no válida.", "error");
    const state = getState();
    const item = (state.directPurchaseItems || []).find(entry => entry.id === itemId);
    if (item) input.value = String(item.quantity || 1);
  }
});
