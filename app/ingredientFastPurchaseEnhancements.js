import { updateState } from "./store.js";
import { formToObject, showAlert } from "./render/ui.js";
import { normalizeUnit, parseNumber, stripDangerousText } from "./utils.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";

function productHasFastPurchaseData(product = {}) {
  return Boolean(product.barcode && Number(product.packageQty || product.packageQuantity || 0) > 0 && (product.packageUnit || product.unit || product.lastPurchasedUnit));
}

function productFromFastPurchaseForm(data, ingredientName = "") {
  return {
    barcode: stripDangerousText(data.barcode || ""),
    brand: stripDangerousText(data.brand || ""),
    productName: stripDangerousText(data.productName || ingredientName),
    packageQty: parseNumber(data.packageQty),
    packageUnit: normalizeUnit(data.packageUnit || "g"),
    packageCount: parseNumber(data.packageCount, 1),
    source: "manual-fast-purchase",
    packagingType: normalizePackagingType(data.packagingType || "otro"),
    updatedAt: new Date().toISOString()
  };
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="fast-purchase-settings"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const data = formToObject(form);
  const ingredientId = form.dataset.ingredientId;
  const enabled = Boolean(form.elements.trustedPurchase?.checked);

  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");

    const product = productFromFastPurchaseForm(data, ingredient.name);
    if (enabled && !productHasFastPurchaseData(product)) {
      throw new Error("Para activar compra rápida necesitas código de barras, cantidad por envase y unidad.");
    }

    ingredient.products ||= [];
    const existingIndex = product.barcode
      ? ingredient.products.findIndex(item => item.barcode === product.barcode)
      : -1;

    if (product.barcode || product.productName || product.packageQty) {
      if (existingIndex >= 0) {
        ingredient.products[existingIndex] = {
          ...ingredient.products[existingIndex],
          ...product,
          updatedAt: new Date().toISOString()
        };
      } else {
        ingredient.products.push({
          ...product,
          createdAt: new Date().toISOString()
        });
      }
    }

    ingredient.trustedPurchase = enabled;
    ingredient.trustedPurchaseEnabled = enabled;
    ingredient.quickPurchaseTrusted = enabled;
    ingredient.trustedPurchaseUpdatedAt = new Date().toISOString();
    ingredient.updatedAt = new Date().toISOString();
  }, "ingredient-fast-purchase-save");

  showAlert(enabled ? "Compra rápida guardada y activada para este ingrediente." : "Compra rápida guardada y desactivada para este ingrediente.");
}, true);
