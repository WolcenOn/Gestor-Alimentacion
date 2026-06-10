import { getState, updateState, subscribe } from "./store.js";
import { escapeHtml } from "./utils.js";
import { showAlert } from "./render/ui.js";

function isTrustedIngredient(ingredient) {
  return Boolean(ingredient?.trustedPurchase || ingredient?.quickPurchaseTrusted);
}

function productHasPackageData(product) {
  return Boolean(product?.barcode && Number(product?.packageQty || product?.packageQuantity || 0) > 0 && (product?.packageUnit || product?.unit));
}

function ingredientHasPackageData(ingredient) {
  return (ingredient?.products || []).some(productHasPackageData);
}

function toggleTrustedIngredient(ingredientId, trusted) {
  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    ingredient.trustedPurchase = Boolean(trusted);
    ingredient.trustedPurchaseUpdatedAt = new Date().toISOString();
    ingredient.updatedAt = new Date().toISOString();
  }, "ingredient-trusted-purchase");
  showAlert(trusted ? "Ingrediente marcado como compra rápida de confianza." : "Compra rápida desactivada para este ingrediente.");
}

function renderTrustedBadge(ingredient) {
  const trusted = isTrustedIngredient(ingredient);
  const hasPackage = ingredientHasPackageData(ingredient);
  const title = trusted
    ? "Compra rápida activada: al escanear en Compra solo pediré el nº de envases."
    : hasPackage
      ? "Este ingrediente puede activarse como compra rápida de confianza."
      : "Añade un producto con código y tamaño de envase para usar compra rápida.";
  return `<span class="badge ${trusted ? "warning" : ""}" title="${escapeHtml(title)}">${trusted ? "confianza" : hasPackage ? "apto compra rápida" : "sin datos envase"}</span>`;
}

function injectIngredientCards() {
  const state = getState();
  document.querySelectorAll(".ingredient-item").forEach(card => {
    const editButton = card.querySelector("[data-ingredient-id]");
    const ingredientId = editButton?.dataset.ingredientId;
    if (!ingredientId || card.querySelector("[data-trusted-ingredient-widget]")) return;
    const ingredient = state.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) return;
    const trusted = isTrustedIngredient(ingredient);
    const widget = document.createElement("div");
    widget.dataset.trustedIngredientWidget = "true";
    widget.className = "trusted-ingredient-widget mini-facts";
    widget.innerHTML = `
      ${renderTrustedBadge(ingredient)}
      <button type="button" class="secondary" data-action="toggle-trusted-ingredient" data-ingredient-id="${escapeHtml(ingredientId)}" data-next-trusted="${trusted ? "false" : "true"}">${trusted ? "Desactivar compra rápida" : "Marcar compra rápida"}</button>
    `;
    const facts = card.querySelector(".mini-facts");
    if (facts) facts.append(...widget.childNodes);
    else card.append(widget);
  });
}

function injectEditModal() {
  const form = document.querySelector('form[data-form="stock-adjust-enhanced"]');
  if (!form || form.querySelector("[name='trustedPurchase']")) return;
  const ingredient = getState().ingredients.find(item => item.id === form.dataset.ingredientId);
  if (!ingredient) return;
  const hasPackage = ingredientHasPackageData(ingredient);
  const trusted = isTrustedIngredient(ingredient);
  const label = document.createElement("label");
  label.className = "check-row trusted-purchase-row";
  label.innerHTML = `
    <input type="checkbox" name="trustedPurchase" value="true" ${trusted ? "checked" : ""}>
    <span><strong>Compra rápida de confianza</strong><small>${hasPackage ? "Si está activado, al escanear este ingrediente en Compra solo pediré nº de envases y calcularé el total." : "Requiere un producto asociado con código de barras, tamaño y unidad de envase."}</small></span>
  `;
  const notes = form.querySelector("textarea[name='notes']")?.closest("label");
  if (notes) notes.after(label);
  else form.append(label);
}

function refreshTrustedUi() {
  injectIngredientCards();
  injectEditModal();
}

subscribe(() => queueMicrotask(refreshTrustedUi));
document.addEventListener("DOMContentLoaded", refreshTrustedUi);
setTimeout(refreshTrustedUi, 0);

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "toggle-trusted-ingredient") {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleTrustedIngredient(button.dataset.ingredientId, button.dataset.nextTrusted === "true");
    return;
  }
  if (["edit-stock", "edit-ingredient-stock"].includes(button.dataset.action)) {
    setTimeout(injectEditModal, 0);
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
