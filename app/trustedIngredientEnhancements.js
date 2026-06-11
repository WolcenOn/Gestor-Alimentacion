import { updateState } from "./store.js";
import { showAlert } from "./render/ui.js";
import { ingredientHasFastPurchaseData } from "./fastPurchase.js";

function toggleTrustedIngredient(ingredientId, trusted) {
  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    if (trusted && !ingredientHasFastPurchaseData(ingredient)) {
      throw new Error("Completa primero los parámetros del desplegable de compra rápida.");
    }
    ingredient.trustedPurchase = Boolean(trusted);
    ingredient.trustedPurchaseUpdatedAt = new Date().toISOString();
    ingredient.updatedAt = new Date().toISOString();
  }, "ingredient-trusted-purchase");
  showAlert(trusted ? "Compra rápida activada para este ingrediente." : "Compra rápida desactivada para este ingrediente.");
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "toggle-trusted-ingredient") {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleTrustedIngredient(button.dataset.ingredientId, button.dataset.nextTrusted === "true");
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="stock-adjust-enhanced"]');
  if (!form) return;
  const checked = form.elements.trustedPurchase?.checked || false;
  const ingredientId = form.dataset.ingredientId;
  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) return;
    ingredient.trustedPurchase = checked;
    ingredient.trustedPurchaseUpdatedAt = new Date().toISOString();
  }, "ingredient-trusted-purchase-save");
}, true);
