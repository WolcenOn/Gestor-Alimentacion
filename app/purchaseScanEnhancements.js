import { getState } from "./store.js";
import { openModal, closeModal, renderBarcodeScannerModal, renderPurchaseModal, showAlert } from "./render/ui.js";
import { scanBarcodeWithPreview } from "./services/barcodeScanner.js";
import { lookupOpenFoodFacts, nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";
import { normalizeUnit, escapeHtml } from "./utils.js";

function findLocalProduct(state, barcode) {
  for (const ingredient of state.ingredients) {
    const product = (ingredient.products || []).find(item => item.barcode === barcode);
    if (product) return { ingredient, product };
  }
  return null;
}

function getPackageQty(product) {
  return Number(product?.packageQty || product?.packageQuantity || product?.lastPurchasedQty || 0) || "";
}

function getPackageUnit(product) {
  return normalizeUnit(product?.packageUnit || product?.unit || product?.lastPurchasedUnit || "");
}

function productToPurchasePrefill(product, barcode = "") {
  if (!product) return { barcode };
  const packageSizeQty = getPackageQty(product);
  const packageSizeUnit = getPackageUnit(product);
  const packageCount = Number(product.packageCount || 1) || 1;
  return {
    barcode: product.barcode || barcode,
    brand: product.brand || "",
    productName: product.productName || "",
    packageSizeQty,
    packageSizeUnit,
    packageCount,
    purchasedQty: packageSizeQty ? Number(packageSizeQty) * packageCount : "",
    unit: packageSizeUnit,
    packagingType: normalizePackagingType(product.packaging || product.packagingType || ""),
    packagingQty: packageCount,
    notes: product.source ? `Datos recuperados de ${product.source}.` : ""
  };
}

function updatePackageTotal(form) {
  const size = Number(form.elements.packageSizeQty?.value || 0);
  const count = Number(form.elements.packagingQty?.value || 0) || 0;
  const packageUnit = normalizeUnit(form.elements.packageSizeUnit?.value || form.elements.unit?.value || "");
  const total = size > 0 && count > 0 ? size * count : 0;
  if (packageUnit && form.elements.unit) form.elements.unit.value = packageUnit;
  if (total > 0 && form.elements.purchasedQty) form.elements.purchasedQty.value = Number(total.toFixed(3));
  const hint = form.querySelector("[data-package-total-hint]");
  if (hint) {
    hint.textContent = total > 0
      ? `${count} envase(s) × ${size} ${packageUnit} = ${Number(total.toFixed(3))} ${packageUnit}`
      : "Puedes indicar envases o escribir directamente la cantidad total.";
  }
}

function openPurchaseFormWithPrefill(ingredientId, prefill = {}) {
  const state = getState();
  openModal(renderPurchaseModal(state, ingredientId, prefill.barcode ? "scan" : "manual", prefill));
  const form = document.querySelector('form[data-form="purchase"]');
  if (form) updatePackageTotal(form);
}

function renderScannedIngredientModal(product = {}, barcode = "") {
  const state = getState();
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
  const prefill = productToPurchasePrefill(product, barcode);
  const name = prefill.productName || product.productName || "Producto escaneado";
  const packagingTypes = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];
  const packagingOptions = packagingTypes.map(type => `<option ${String(prefill.packagingType || "otro") === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
  const unitOption = unit => `<option ${prefill.unit === unit ? "selected" : ""}>${unit}</option>`;
  return `
    <header>
      <div><h2>Ingrediente escaneado</h2><p class="muted">Revisa cantidad por envase, nº de envases y total que entrará al stock.</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <form data-form="ingredient" data-scanned-ingredient="true">
      <div class="form-grid package-purchase-grid">
        <label>Nombre<input name="name" required value="${escapeHtml(name)}"></label>
        <label>Familia<select name="familyId">${familyOptions}</select></label>
        <label>Tamaño por envase<input name="packageSizeQty" data-package-size type="number" step="0.01" min="0" value="${escapeHtml(String(prefill.packageSizeQty || ""))}" placeholder="Ej. 1000"></label>
        <label>Unidad del envase<select name="packageSizeUnit" data-package-unit>${unitOption("g")}${unitOption("kg")}${unitOption("ml")}${unitOption("l")}${unitOption("unidades")}</select></label>
        <label>Nº de envases comprados<input name="packagingQty" data-package-count type="number" min="0" step="1" value="${escapeHtml(String(prefill.packageCount || 1))}"></label>
        <label>Total en stock<input name="qty" data-total-qty type="number" step="0.01" min="0" required value="${escapeHtml(String(prefill.purchasedQty || 0))}"></label>
        <label>Unidad total<select name="unit" data-total-unit>${unitOption("g")}${unitOption("kg")}${unitOption("ml")}${unitOption("l")}${unitOption("unidades")}</select></label>
        <div class="package-total-hint small muted" data-package-total-hint></div>
        <label>Conservación<select name="storageType"><option value="pantry">Despensa</option><option value="fridge">Nevera</option><option value="freezer">Congelador</option></select></label>
        <label>Caducidad<input name="expiryDate" type="date"></label>
        <label>Tipo de fecha<select name="dateType"><option value="expiry">Caducidad</option><option value="bestBefore">Consumo preferente</option><option value="none">Sin fecha</option></select></label>
        <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="0"></label>
        <label>Tipo de envase<select name="packagingType">${packagingOptions}</select></label>
        <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(prefill.barcode || barcode)}"></label>
        <label>Marca<input name="brand" value="${escapeHtml(prefill.brand || "")}"></label>
        <label>Nombre del producto<input name="productName" value="${escapeHtml(prefill.productName || name)}"></label>
      </div>
      <button>Añadir ingrediente</button>
    </form>
  `;
}

async function scanBarcodeInCompactModal({ title, target, ingredientId = "" }) {
  openModal(renderBarcodeScannerModal({ title, target, ingredientId, autoStart: true }));
  await new Promise(resolve => requestAnimationFrame(resolve));
  const video = document.getElementById("barcodeVideo");
  const status = document.getElementById("scannerStatus");
  if (!video) throw new Error("No se pudo abrir la cámara.");
  const barcode = await scanBarcodeWithPreview(video, status);
  if (status) status.textContent = `Código detectado: ${barcode}. Buscando datos...`;
  return barcode;
}

async function openDirectPurchaseScanner(ingredientId) {
  const barcode = await scanBarcodeInCompactModal({ title: "Escanear compra", target: "direct-purchase", ingredientId });
  const state = getState();
  const local = findLocalProduct(state, barcode);
  if (local?.product) {
    closeModal();
    openPurchaseFormWithPrefill(ingredientId, productToPurchasePrefill(local.product, barcode));
    showAlert("Producto encontrado en tu base local.");
    return;
  }
  let offProduct = null;
  try { offProduct = await lookupOpenFoodFacts(barcode); }
  catch (error) { console.warn(error); }
  closeModal();
  openPurchaseFormWithPrefill(ingredientId, offProduct ? productToPurchasePrefill(offProduct, barcode) : { barcode });
  showAlert(offProduct ? "Producto encontrado en Open Food Facts. Ajusta envases si compras más de uno." : "Código detectado, pero no se encontró información. Completa los datos manualmente.");
}

async function openDirectIngredientScanner() {
  const barcode = await scanBarcodeInCompactModal({ title: "Escanear nuevo alimento", target: "direct-ingredient" });
  let product = null;
  try { product = await lookupOpenFoodFacts(barcode); }
  catch (error) { console.warn(error); }
  closeModal();
  openModal(renderScannedIngredientModal(product || {}, barcode));
  const form = document.querySelector('form[data-form="ingredient"][data-scanned-ingredient="true"]');
  if (form) updatePackageTotal(form);
  showAlert(product ? "Producto encontrado en Open Food Facts. Revisa cantidad, envases y stock." : "Código detectado, pero sin datos. Completa el ingrediente manualmente.");
}

document.addEventListener("input", event => {
  const form = event.target.closest('form[data-form="purchase"], form[data-scanned-ingredient="true"]');
  if (!form) return;
  if (event.target.matches("[data-package-size], [data-package-count]")) updatePackageTotal(form);
}, true);

document.addEventListener("change", event => {
  const form = event.target.closest('form[data-form="purchase"], form[data-scanned-ingredient="true"]');
  if (!form) return;
  if (event.target.matches("[data-package-unit]")) updatePackageTotal(form);
}, true);

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "manual-shopping-item") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openPurchaseFormWithPrefill(button.dataset.ingredientId, {});
  }

  if (button.dataset.action === "scan-shopping-item") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openDirectPurchaseScanner(button.dataset.ingredientId).catch(error => {
      console.error(error);
      showAlert(error.message || "No se pudo escanear la compra.", "error");
      openPurchaseFormWithPrefill(button.dataset.ingredientId, {});
    });
  }

  if (button.dataset.action === "scan-new-ingredient") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openDirectIngredientScanner().catch(error => {
      console.error(error);
      showAlert(error.message || "No se pudo escanear el ingrediente.", "error");
    });
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="purchase"], form[data-scanned-ingredient="true"]');
  if (!form) return;
  updatePackageTotal(form);
}, true);
