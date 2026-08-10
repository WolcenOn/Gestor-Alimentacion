import { getState } from "./store.js";
import { openModal, closeModal, renderBarcodeScannerModal, renderPurchaseModal, showAlert } from "./render/ui.js";
import { scanBarcodeWithPreview } from "./services/barcodeScanner.js";
import { lookupOpenFoodFacts } from "./services/openFoodFacts.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";
import { escapeHtml, normalizeUnit } from "./utils.js";

function findLocalProduct(state, barcode) {
  for (const ingredient of state.ingredients || []) {
    const product = (ingredient.products || []).find(item => item.barcode === barcode);
    if (product) return { ingredient, product };
  }
  return null;
}

function getPackageQty(product) {
  return Number(product?.packageQty || product?.packageQuantity || 0) || "";
}

function getPackageUnit(product) {
  return normalizeUnit(product?.packageUnit || product?.unit || product?.lastPurchasedUnit || "");
}

function getKnownPrice(ingredient, product) {
  const productPrice = Number(product?.price || product?.lastPrice || 0);
  if (productPrice > 0) return productPrice;
  const barcodePrice = (ingredient?.products || [])
    .map(item => Number(item.price || item.lastPrice || 0))
    .find(price => price > 0);
  if (barcodePrice) return barcodePrice;
  const ingredientPrice = Number(ingredient?.approxPrice || 0);
  return ingredientPrice > 0 ? ingredientPrice : "";
}

function productToPurchasePrefill(product, barcode = "", ingredient = null) {
  const packageSizeQty = getPackageQty(product);
  const packageSizeUnit = getPackageUnit(product) || normalizeUnit(ingredient?.unit || "");
  const packageCount = Number(product?.packageCount || product?.packagingQty || 1) || 1;
  const price = getKnownPrice(ingredient, product);
  return {
    barcode: product?.barcode || barcode,
    brand: product?.brand || "",
    productName: product?.productName || ingredient?.name || "",
    packageSizeQty,
    packageSizeUnit,
    packageCount,
    purchasedQty: packageSizeQty ? Number(packageSizeQty) * packageCount : "",
    unit: packageSizeUnit || ingredient?.unit || "",
    packagingType: normalizePackagingType(product?.packaging || product?.packagingType || ingredient?.packagingType || "otro"),
    packagingQty: packageCount,
    price,
    priceSource: product?.priceSource || "local",
    priceSourceLabel: price ? (product?.priceSourceLabel || "Precio guardado") : "",
    notes: product?.source ? `Datos recuperados de ${product.source}.` : ""
  };
}

function mergePriceFromKnownProduct(prefill, ingredient, barcode) {
  const matching = (ingredient?.products || []).find(product => product.barcode === barcode)
    || (ingredient?.products || []).find(product => Number(product.price || 0) > 0)
    || null;
  const knownPrice = getKnownPrice(ingredient, matching);
  return {
    ...prefill,
    price: Number(prefill.price || 0) > 0 ? prefill.price : knownPrice,
    priceSource: prefill.priceSource || (knownPrice ? "local" : ""),
    priceSourceLabel: prefill.priceSourceLabel || (knownPrice ? "Precio guardado" : "")
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

function enhancePriceConfirmation(form, prefill = {}) {
  if (!form || form.dataset.scanPriceEnhanced === "true") return;
  form.dataset.scanPriceEnhanced = "true";
  const priceInput = form.elements.price;
  if (!priceInput) return;
  priceInput.required = true;
  priceInput.placeholder = "Confirma o corrige el precio";
  const priceLabel = priceInput.closest("label");
  if (!priceLabel) return;
  const knownPrice = Number(prefill.price || 0);
  const helper = document.createElement("p");
  helper.className = "small muted scan-price-helper";
  helper.textContent = knownPrice > 0
    ? `Precio guardado: ${knownPrice.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}. Confírmalo o corrígelo antes de guardar.`
    : "Añade el precio de esta compra para guardarlo y precargarlo la próxima vez.";
  priceLabel.append(helper);

  if (knownPrice > 0) {
    priceInput.value = String(knownPrice);
    priceInput.select?.();
  } else {
    priceInput.focus?.();
  }
}

async function scanBarcodeInCompactModal({ title, target, ingredientId = "" }) {
  openModal(renderBarcodeScannerModal({ title, target, ingredientId, autoStart: true }));
  await new Promise(resolve => requestAnimationFrame(resolve));
  const video = document.getElementById("barcodeVideo");
  const status = document.getElementById("scannerStatus");
  if (!video) throw new Error("No se pudo abrir la cámara.");
  const barcode = await scanBarcodeWithPreview(video, status);
  if (status) status.textContent = `Código detectado: ${barcode}. Buscando precio y datos guardados...`;
  return barcode;
}

function openPurchaseFormWithPriceConfirmation(ingredientId, prefill = {}) {
  const state = getState();
  openModal(renderPurchaseModal(state, ingredientId, "scan", prefill));
  const form = document.querySelector('form[data-form="purchase"]');
  if (form) {
    updatePackageTotal(form);
    enhancePriceConfirmation(form, prefill);
  }
}

async function openDirectPurchaseScannerWithPrice(ingredientId) {
  const barcode = await scanBarcodeInCompactModal({ title: "Escanear compra", target: "direct-purchase", ingredientId });
  const state = getState();
  const expectedIngredient = state.ingredients.find(item => item.id === ingredientId);
  const local = findLocalProduct(state, barcode);

  if (local?.product) {
    closeModal();
    const prefill = productToPurchasePrefill(local.product, barcode, expectedIngredient || local.ingredient);
    openPurchaseFormWithPriceConfirmation(ingredientId, prefill);
    showAlert("Producto encontrado en tu base local. Revisa el precio guardado antes de confirmar la compra.");
    return;
  }

  let offProduct = null;
  try { offProduct = await lookupOpenFoodFacts(barcode); }
  catch (error) { console.warn(error); }

  closeModal();
  const basePrefill = offProduct ? productToPurchasePrefill(offProduct, barcode, expectedIngredient) : { barcode };
  const prefill = mergePriceFromKnownProduct(basePrefill, expectedIngredient, barcode);
  openPurchaseFormWithPriceConfirmation(ingredientId, prefill);
  showAlert(prefill.price
    ? "Código escaneado. He precargado el precio guardado para confirmarlo o corregirlo."
    : "Código escaneado. Añade el precio para guardarlo en esta compra.");
}

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="scan-shopping-item"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openDirectPurchaseScannerWithPrice(button.dataset.ingredientId).catch(error => {
    console.error(error);
    showAlert(error.message || "No se pudo escanear la compra.", "error");
  });
}, true);
