import { getState } from "./store.js";
import { openModal, closeModal, renderBarcodeScannerModal, renderPurchaseModal, showAlert } from "./render/ui.js";
import { scanBarcodeWithPreview } from "./services/barcodeScanner.js";
import { lookupOpenFoodFacts } from "./services/openFoodFacts.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";
import { normalizeUnit } from "./utils.js";

function findLocalProduct(state, barcode) {
  for (const ingredient of state.ingredients) {
    const product = (ingredient.products || []).find(item => item.barcode === barcode);
    if (product) return { ingredient, product };
  }
  return null;
}

function productToPurchasePrefill(product, barcode = "") {
  if (!product) return { barcode };
  return {
    barcode: product.barcode || barcode,
    brand: product.brand || "",
    productName: product.productName || "",
    purchasedQty: Number(product.packageQty || product.packageQuantity || 0) || "",
    unit: normalizeUnit(product.packageUnit || product.unit || ""),
    packagingType: normalizePackagingType(product.packaging || product.packagingType || ""),
    packagingQty: 1,
    notes: product.source ? `Datos recuperados de ${product.source}.` : ""
  };
}

function openPurchaseFormWithPrefill(ingredientId, prefill = {}) {
  const state = getState();
  openModal(renderPurchaseModal(state, ingredientId, prefill.barcode ? "scan" : "manual", prefill));
}

async function openDirectScanner(ingredientId) {
  openModal(renderBarcodeScannerModal({ title: "Escanear compra", target: "direct-purchase", ingredientId, autoStart: true }));
  await new Promise(resolve => requestAnimationFrame(resolve));
  const video = document.getElementById("barcodeVideo");
  const status = document.getElementById("scannerStatus");
  if (!video) throw new Error("No se pudo abrir la cámara.");

  const barcode = await scanBarcodeWithPreview(video, status);
  if (status) status.textContent = `Código detectado: ${barcode}. Buscando datos...`;

  const state = getState();
  const local = findLocalProduct(state, barcode);
  if (local?.product) {
    closeModal();
    openPurchaseFormWithPrefill(ingredientId, productToPurchasePrefill(local.product, barcode));
    showAlert("Producto encontrado en tu base local.");
    return;
  }

  let offProduct = null;
  try {
    offProduct = await lookupOpenFoodFacts(barcode);
  } catch (error) {
    console.warn(error);
  }

  closeModal();
  openPurchaseFormWithPrefill(ingredientId, offProduct ? productToPurchasePrefill(offProduct, barcode) : { barcode });
  showAlert(offProduct ? "Producto encontrado en Open Food Facts. Completa los datos que falten." : "Código detectado, pero no se encontró información. Completa los datos manualmente.");
}

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
    openDirectScanner(button.dataset.ingredientId).catch(error => {
      console.error(error);
      showAlert(error.message || "No se pudo escanear la compra.", "error");
      openPurchaseFormWithPrefill(button.dataset.ingredientId, {});
    });
  }
}, true);
