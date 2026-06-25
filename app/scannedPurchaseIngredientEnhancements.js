import { updateState } from "./store.js";
import { withMeta } from "./models.js";
import { closeModal, formToObject, showAlert } from "./render/ui.js";
import { normalizeUnit, parseNumber, stripDangerousText } from "./utils.js";
import { registerPurchase } from "./state/stock.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";

function scannedProductFromForm(data, ingredientName = "") {
  return {
    barcode: stripDangerousText(data.barcode || ""),
    brand: stripDangerousText(data.brand || ""),
    productName: stripDangerousText(data.productName || data.name || ingredientName),
    packageQty: parseNumber(data.packageSizeQty || data.packageQty || data.qty),
    packageUnit: normalizeUnit(data.packageSizeUnit || data.packageUnit || data.unit || "g"),
    price: parseNumber(data.approxPrice),
    source: "openfoodfacts-scan",
    packagingType: normalizePackagingType(data.packagingType || "otro"),
    packaging: stripDangerousText(data.packaging || ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function saveScannedIngredientPurchase(form) {
  const data = formToObject(form);
  const stockQty = parseNumber(data.qty || data.purchasedQty || data.packageSizeQty || data.packageQty);
  const unit = normalizeUnit(data.unit || data.packageSizeUnit || data.packageUnit || "g");
  const packagingQty = parseNumber(data.packagingQty) || 1;
  const packageSizeQty = parseNumber(data.packageSizeQty || data.packageQty || stockQty);
  const packageSizeUnit = normalizeUnit(data.packageSizeUnit || data.packageUnit || unit);
  let ingredientName = stripDangerousText(data.name || data.productName || "Ingrediente");

  if (stockQty <= 0) throw new Error("Indica una cantidad de stock mayor que cero para registrar la compra.");

  updateState(draft => {
    const product = scannedProductFromForm(data, ingredientName);
    const ingredient = withMeta({
      name: ingredientName,
      familyId: data.familyId,
      qty: 0,
      unit,
      available: false,
      storageType: data.storageType || "pantry",
      expiryDate: data.expiryDate || "",
      dateType: data.dateType || "none",
      approxPrice: parseNumber(data.approxPrice),
      packagingType: normalizePackagingType(data.packagingType || product.packagingType || "otro"),
      notes: stripDangerousText(data.notes || data.ingredientsText || ""),
      products: product.barcode || product.productName || product.brand ? [product] : []
    }, "ingredient");

    draft.ingredients.push(ingredient);
    ingredientName = ingredient.name;

    registerPurchase(draft, {
      ingredientId: ingredient.id,
      weekId: draft.activeWeekId,
      requiredQty: stockQty,
      purchasedQty: stockQty,
      unit,
      barcode: product.barcode,
      brand: product.brand,
      productName: product.productName || ingredient.name,
      productSource: product.source,
      price: parseNumber(data.approxPrice),
      purchaseDate: new Date().toISOString().slice(0, 10),
      expiryDate: data.expiryDate || "",
      dateType: data.dateType || "none",
      storageType: data.storageType || "pantry",
      isPartial: false,
      source: "scanned-new-ingredient-purchase",
      packagingType: normalizePackagingType(data.packagingType || "otro"),
      packagingQty,
      packageSizeQty,
      packageSizeUnit
    });
  }, "scanned-ingredient-purchase");

  closeModal();
  form.reset?.();
  showAlert(`${ingredientName} guardado como ingrediente y registrado en compras/stock.`);
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="ingredient"][data-scanned-ingredient="true"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    saveScannedIngredientPurchase(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo guardar la compra escaneada.", "error");
  }
}, true);
