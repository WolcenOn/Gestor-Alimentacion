import { updateState } from "./store.js";
import { showAlert } from "./render/ui.js";

function productHasFastPurchaseData(product = {}) {
  return Boolean(product.barcode && Number(product.packageQty || product.packageQuantity || 0) > 0 && (product.packageUnit || product.unit || product.lastPurchasedUnit));
}

function ingredientCanUseFastPurchase(ingredient = {}) {
  return (ingredient.products || []).some(productHasFastPurchaseData);
}

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="toggle-ingredient-fast-purchase"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const ingredientId = button.dataset.ingredientId;
  let enabled = false;

  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    if (!ingredientCanUseFastPurchase(ingredient)) {
      throw new Error("Primero asocia un producto con código, tamaño de envase y unidad.");
    }
    ingredient.trustedPurchaseEnabled = !ingredient.trustedPurchaseEnabled;
    enabled = ingredient.trustedPurchaseEnabled;
    ingredient.updatedAt = new Date().toISOString();
  }, "ingredient-fast-purchase-toggle");

  showAlert(enabled ? "Compra rápida activada para este ingrediente." : "Compra rápida desactivada para este ingrediente.");
}, true);
