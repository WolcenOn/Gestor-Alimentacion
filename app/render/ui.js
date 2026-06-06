import { escapeHtml, formatQty, parseNumber, todayIsoDate } from "../utils.js";
import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";

export function showAlert(message, type = "info") {
  const root = document.getElementById("alerts");
  const el = document.createElement("div");
  el.className = `alert ${type === "error" ? "error" : ""}`;
  el.textContent = message;
  root.append(el);
  setTimeout(() => el.remove(), 5500);
}

export function openModal(html) {
  document.getElementById("modalRoot").innerHTML = `<section class="modal" role="dialog" aria-modal="true">${html}</section>`;
  document.querySelector(".modal input, .modal select, .modal button")?.focus();
}

export function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

export function renderPurchaseModal(state, ingredientId, mode = "manual") {
  const item = computeShoppingListWithProgress(state).find(i => i.ingredientId === ingredientId);
  const ingredient = state.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return "";
  const suggestedQty = item?.remainingQty || 1;
  const unit = item?.unit || ingredient.unit;
  return `
    <header>
      <div><h2>${mode === "scan" ? "Escanear compra" : "Añadir compra"}</h2><p class="muted">${escapeHtml(ingredient.name)} · sugerido: ${formatQty(suggestedQty, unit)}</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <form data-form="purchase" data-ingredient-id="${escapeHtml(ingredientId)}" data-required-qty="${escapeHtml(String(item?.missingQty || suggestedQty))}" data-unit="${escapeHtml(unit)}">
      <div class="form-grid">
        <label>Cantidad comprada<input name="purchasedQty" type="number" step="0.01" min="0.01" value="${escapeHtml(String(suggestedQty))}" required></label>
        <label>Unidad<select name="unit"><option ${unit === "g" ? "selected" : ""}>g</option><option ${unit === "kg" ? "selected" : ""}>kg</option><option ${unit === "ml" ? "selected" : ""}>ml</option><option ${unit === "l" ? "selected" : ""}>l</option><option ${unit === "unidades" ? "selected" : ""}>unidades</option></select></label>
        <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" placeholder="opcional"></label>
        <label>Marca<input name="brand" placeholder="opcional"></label>
        <label>Precio<input name="price" type="number" step="0.01" min="0" placeholder="opcional"></label>
        <label>Fecha compra<input name="purchaseDate" type="date" value="${todayIsoDate()}"></label>
        <label>Tipo de fecha<select name="dateType"><option value="expiry">Caducidad</option><option value="bestBefore">Consumo preferente</option><option value="none">Sin fecha</option></select></label>
        <label>Fecha alimento<input name="expiryDate" type="date"></label>
        <label>Conservación<select name="storageType"><option value="pantry">Despensa</option><option value="fridge">Nevera</option><option value="freezer">Congelador</option></select></label>
        <label>Nombre producto<input name="productName" placeholder="opcional"></label>
        <label>Tipo de envase<select name="packagingType"><option>plástico</option><option>cartón/papel</option><option>vidrio</option><option>metal</option><option>brik</option><option>orgánico</option><option>otro</option></select></label>
        <label>Nº de envases para reciclar<input name="packagingQty" type="number" min="0" step="1" value="1"></label>
      </div>
      <label>Notas<textarea name="notes"></textarea></label>
      <div class="actions">
        <button name="purchaseMode" value="partial">Guardar compra parcial</button>
        <button name="purchaseMode" value="complete" class="secondary">Guardar compra completa</button>
        ${mode === "scan" ? `<button type="button" class="secondary" data-action="open-purchase-scanner">Abrir cámara</button>` : ""}
      </div>
    </form>
  `;
}

export function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function getSubmitterValue(event, name) {
  return event.submitter?.name === name ? event.submitter.value : "";
}

export { parseNumber };


export function renderBarcodeScannerModal({ title = "Escanear código", target = "purchase", ingredientId = "" } = {}) {
  return `
    <header>
      <div><h2>${escapeHtml(title)}</h2><p class="muted">En móvil verás la cámara para apuntar al código. Si tu navegador no soporta BarcodeDetector, usa entrada manual.</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <div class="scanner-box" data-scanner-target="${escapeHtml(target)}" data-ingredient-id="${escapeHtml(ingredientId)}">
      <div class="scanner-frame">
        <video id="barcodeVideo" autoplay muted playsinline></video>
        <div class="scanner-reticle" aria-hidden="true"></div>
      </div>
      <p id="scannerStatus" class="small muted">Pulsa “Activar cámara”.</p>
      <div class="actions">
        <button type="button" data-action="start-preview-scan">Activar cámara</button>
        <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
      </div>
    </div>
  `;
}
