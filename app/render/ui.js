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

export function renderPurchaseModal(state, ingredientId, mode = "manual", prefill = {}) {
  const item = computeShoppingListWithProgress(state).find(i => i.ingredientId === ingredientId);
  const ingredient = state.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return "";
  const packageSizeQty = Number(prefill.packageSizeQty || prefill.purchasedQty || 0) || "";
  const packageSizeUnit = prefill.packageSizeUnit || prefill.unit || item?.unit || ingredient.unit;
  const packageCount = Number(prefill.packageCount || prefill.packagingQty || 1) || 1;
  const calculatedQty = packageSizeQty ? Number(packageSizeQty) * packageCount : "";
  const suggestedQty = prefill.purchasedQty || calculatedQty || item?.remainingQty || 1;
  const unit = prefill.unit || packageSizeUnit || item?.unit || ingredient.unit;
  const title = mode === "scan" ? "Compra escaneada" : "Añadir compra";
  const subtitle = mode === "scan" && prefill.barcode
    ? `${ingredient.name} · código ${prefill.barcode}`
    : `${ingredient.name} · sugerido: ${formatQty(suggestedQty, unit)}`;
  return `
    <header>
      <div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(subtitle)}</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <form data-form="purchase" data-ingredient-id="${escapeHtml(ingredientId)}" data-required-qty="${escapeHtml(String(item?.missingQty || suggestedQty))}" data-unit="${escapeHtml(unit)}">
      <div class="form-grid package-purchase-grid">
        <label>Tamaño por envase<input name="packageSizeQty" data-package-size type="number" step="0.01" min="0" value="${escapeHtml(String(packageSizeQty))}" placeholder="Ej. 1"></label>
        <label>Unidad del envase<select name="packageSizeUnit" data-package-unit><option ${packageSizeUnit === "g" ? "selected" : ""}>g</option><option ${packageSizeUnit === "kg" ? "selected" : ""}>kg</option><option ${packageSizeUnit === "ml" ? "selected" : ""}>ml</option><option ${packageSizeUnit === "l" ? "selected" : ""}>l</option><option ${packageSizeUnit === "unidades" ? "selected" : ""}>unidades</option></select></label>
        <label>Nº de envases comprados<input name="packagingQty" data-package-count type="number" min="0" step="1" value="${escapeHtml(String(packageCount))}"></label>
        <label>Total que entra al stock<input name="purchasedQty" data-total-qty type="number" step="0.01" min="0.01" value="${escapeHtml(String(suggestedQty))}" required></label>
        <label>Unidad total<select name="unit" data-total-unit><option ${unit === "g" ? "selected" : ""}>g</option><option ${unit === "kg" ? "selected" : ""}>kg</option><option ${unit === "ml" ? "selected" : ""}>ml</option><option ${unit === "l" ? "selected" : ""}>l</option><option ${unit === "unidades" ? "selected" : ""}>unidades</option></select></label>
        <div class="package-total-hint small muted" data-package-total-hint>${packageSizeQty ? `${packageCount} envase(s) × ${packageSizeQty} ${escapeHtml(packageSizeUnit)} = ${suggestedQty} ${escapeHtml(unit)}` : "Puedes indicar envases o escribir directamente la cantidad total."}</div>
        <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" placeholder="opcional" value="${escapeHtml(prefill.barcode || "")}"></label>
        <label>Marca<input name="brand" placeholder="opcional" value="${escapeHtml(prefill.brand || "")}"></label>
        <label>Precio<input name="price" type="number" step="0.01" min="0" placeholder="opcional" value="${escapeHtml(String(prefill.price || ""))}"></label>
        <label>Fecha compra<input name="purchaseDate" type="date" value="${escapeHtml(prefill.purchaseDate || todayIsoDate())}"></label>
        <label>Tipo de fecha<select name="dateType"><option value="expiry" ${prefill.dateType === "expiry" ? "selected" : ""}>Caducidad</option><option value="bestBefore" ${prefill.dateType === "bestBefore" ? "selected" : ""}>Consumo preferente</option><option value="none" ${prefill.dateType === "none" ? "selected" : ""}>Sin fecha</option></select></label>
        <label>Fecha alimento<input name="expiryDate" type="date" value="${escapeHtml(prefill.expiryDate || "")}"></label>
        <label>Conservación<select name="storageType"><option value="pantry" ${prefill.storageType === "pantry" ? "selected" : ""}>Despensa</option><option value="fridge" ${prefill.storageType === "fridge" ? "selected" : ""}>Nevera</option><option value="freezer" ${prefill.storageType === "freezer" ? "selected" : ""}>Congelador</option></select></label>
        <label>Nombre producto<input name="productName" placeholder="opcional" value="${escapeHtml(prefill.productName || ingredient.name || "")}"></label>
        <label>Tipo de envase<select name="packagingType">${["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"].map(type => `<option ${String(prefill.packagingType || "otro") === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
      </div>
      ${mode === "scan" ? `<p class="small muted">Se han rellenado los datos encontrados. Ajusta el nº de envases si compras más de una unidad.</p>` : ""}
      <label>Notas<textarea name="notes">${escapeHtml(prefill.notes || "")}</textarea></label>
      <div class="actions">
        <button name="purchaseMode" value="partial">Guardar compra parcial</button>
        <button name="purchaseMode" value="complete" class="secondary">Guardar compra completa</button>
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


export function renderBarcodeScannerModal({ title = "Escanear código", target = "purchase", ingredientId = "", autoStart = false } = {}) {
  return `
    <header>
      <div><h2>${escapeHtml(title)}</h2><p class="muted">Apunta al código de barras. Después se abrirá el formulario con los datos encontrados.</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <div class="scanner-box compact-scanner" data-scanner-target="${escapeHtml(target)}" data-ingredient-id="${escapeHtml(ingredientId)}" data-auto-start="${autoStart ? "true" : "false"}">
      <div class="scanner-frame compact-scanner-frame">
        <video id="barcodeVideo" autoplay muted playsinline></video>
        <div class="scanner-reticle" aria-hidden="true"></div>
      </div>
      <p id="scannerStatus" class="small muted">${autoStart ? "Activando cámara..." : "Pulsa “Activar cámara”."}</p>
      <div class="actions">
        ${autoStart ? "" : `<button type="button" data-action="start-preview-scan">Activar cámara</button>`}
        <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
      </div>
    </div>
  `;
}
