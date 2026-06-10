import { updateState } from "./store.js";
import { formToObject, showAlert } from "./render/ui.js";
import { normalizeUnit, parseNumber, stripDangerousText } from "./utils.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";

function productHasFastPurchaseData(product = {}) {
  return Boolean(Number(product.packageQty || product.packageQuantity || 0) > 0 && (product.packageUnit || product.unit || product.lastPurchasedUnit));
}

function productFromFastPurchaseForm(data, ingredientName = "") {
  return {
    barcode: stripDangerousText(data.barcode || ""),
    brand: stripDangerousText(data.brand || ""),
    productName: stripDangerousText(data.productName || ingredientName),
    packageQty: parseNumber(data.packageQty),
    packageUnit: normalizeUnit(data.packageUnit || "g"),
    packageCount: Math.max(1, parseNumber(data.packageCount) || 1),
    source: "manual-fast-purchase",
    packagingType: normalizePackagingType(data.packagingType || "otro"),
    updatedAt: new Date().toISOString()
  };
}

function setFormStatus(form, message, type = "info") {
  let status = form.querySelector("[data-fast-purchase-status]");
  if (!status) {
    status = document.createElement("p");
    status.dataset.fastPurchaseStatus = "true";
    status.className = "small muted";
    form.querySelector(".actions")?.before(status);
  }
  status.textContent = message;
  status.className = `small ${type === "error" ? "error-text" : "muted"}`;
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="fast-purchase-settings"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  try {
    const data = formToObject(form);
    const ingredientId = form.dataset.ingredientId;
    const enabled = Boolean(form.elements.trustedPurchase?.checked);
    let savedEnabled = enabled;

    updateState(draft => {
      const ingredient = draft.ingredients.find(item => item.id === ingredientId);
      if (!ingredient) throw new Error("Ingrediente no encontrado.");

      const product = productFromFastPurchaseForm(data, ingredient.name);
      if (enabled && !productHasFastPurchaseData(product)) {
        throw new Error("Para activar compra rápida necesitas cantidad por envase y unidad. El código de barras es opcional.");
      }

      ingredient.products ||= [];
      const existingIndex = product.barcode
        ? ingredient.products.findIndex(item => item.barcode === product.barcode)
        : ingredient.products.findIndex(item => item.source === "manual-fast-purchase" || !item.barcode);

      if (product.productName || product.packageQty) {
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
      savedEnabled = enabled;
    }, "ingredient-fast-purchase-save");

    const message = savedEnabled
      ? "Compra rápida guardada y activada. Ya verás ⚡ en Compra."
      : "Compra rápida guardada y desactivada.";
    setFormStatus(form, message);
    showAlert(message);
  } catch (error) {
    const message = error.message || "No se pudo guardar la compra rápida.";
    setFormStatus(form, message, "error");
    showAlert(message, "error");
  }
}, true);
