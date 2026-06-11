import { normalizeUnit } from "./utils.js";

export function isTrustedPurchaseEnabled(ingredient = {}) {
  return Boolean(ingredient.trustedPurchase);
}

export function normalizeTrustedPurchaseFlag(ingredient = {}) {
  ingredient.trustedPurchase = Boolean(
    ingredient.trustedPurchase ||
    ingredient.trustedPurchaseEnabled ||
    ingredient.quickPurchaseTrusted
  );
  delete ingredient.trustedPurchaseEnabled;
  delete ingredient.quickPurchaseTrusted;
  return ingredient.trustedPurchase;
}

export function getPackageQty(product = {}) {
  return Number(product.packageQty || product.packageQuantity || 0) || 0;
}

export function getPackageUnit(product = {}) {
  return normalizeUnit(product.packageUnit || product.unit || product.lastPurchasedUnit || "");
}

export function productHasFastPurchaseData(product = {}) {
  return Boolean(getPackageQty(product) > 0 && getPackageUnit(product));
}

export function productHasScannableFastPurchaseData(product = {}) {
  return Boolean(product.barcode && productHasFastPurchaseData(product));
}

export function getFastPurchaseProduct(ingredient = {}) {
  return (ingredient.products || []).find(productHasScannableFastPurchaseData)
    || (ingredient.products || []).find(productHasFastPurchaseData)
    || null;
}

export function ingredientHasFastPurchaseData(ingredient = {}) {
  return Boolean(getFastPurchaseProduct(ingredient));
}

export function ingredientCanUseFastPurchase(ingredient = {}) {
  return isTrustedPurchaseEnabled(ingredient) && ingredientHasFastPurchaseData(ingredient);
}
