import { uid, nowIso, toBaseQty, normalizeUnit } from "../utils.js";
import { getWeekProgress, setWeekProgress } from "./shoppingProgress.js";
import { validatePurchaseInput } from "../validation.js";

export function registerPurchase(state, input) {
  validatePurchaseInput(input);
  const ingredient = state.ingredients.find(i => i.id === input.ingredientId);
  if (!ingredient) throw new Error("Ingrediente no encontrado.");

  const purchased = toBaseQty(input.purchasedQty, input.unit);
  const ingredientBase = toBaseQty(ingredient.qty, ingredient.unit);
  if (ingredientBase.unit !== purchased.unit) throw new Error("No se pueden sumar unidades incompatibles al stock.");

  ingredient.qty = ingredientBase.qty + purchased.qty;
  ingredient.unit = ingredientBase.unit;
  ingredient.available = ingredient.qty > 0;
  ingredient.updatedAt = nowIso();

  state.purchaseLots.push({
    id: uid("lot"),
    ingredientId: ingredient.id,
    qty: purchased.qty,
    unit: purchased.unit,
    barcode: input.barcode || "",
    brand: input.brand || "",
    purchaseDate: input.purchaseDate || new Date().toISOString().slice(0, 10),
    expiryDate: input.expiryDate || "",
    dateType: input.dateType || "none",
    storageType: input.storageType || ingredient.storageType || "pantry",
    source: input.source || "shopping-list",
    createdAt: nowIso(),
    schemaVersion: 1
  });

  state.purchaseEntries.push({
    id: uid("purchase"),
    weekId: input.weekId,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    requiredQty: Number(input.requiredQty) || 0,
    purchasedQty: purchased.qty,
    unit: purchased.unit,
    barcode: input.barcode || "",
    brand: input.brand || "",
    price: Number(input.price) || 0,
    isPartial: Boolean(input.isPartial),
    createdAt: nowIso(),
    schemaVersion: 1
  });

  const progress = getWeekProgress(state, input.weekId);
  const previous = progress[ingredient.id] || { requiredQty: Number(input.requiredQty) || 0, purchasedQty: 0, unit: purchased.unit, status: "pending" };
  const previousBase = toBaseQty(previous.purchasedQty, previous.unit);
  const totalPurchased = previousBase.unit === purchased.unit ? previousBase.qty + purchased.qty : purchased.qty;
  const requiredBase = toBaseQty(previous.requiredQty || input.requiredQty || 0, previous.unit || purchased.unit);
  progress[ingredient.id] = {
    requiredQty: requiredBase.unit === purchased.unit ? requiredBase.qty : Number(input.requiredQty) || 0,
    purchasedQty: totalPurchased,
    unit: purchased.unit,
    status: totalPurchased >= (Number(input.requiredQty) || requiredBase.qty) ? "done" : "partial"
  };
  setWeekProgress(state, input.weekId, progress);

  if (input.barcode) {
    ingredient.products ||= [];
    const exists = ingredient.products.some(p => p.barcode === input.barcode);
    if (!exists) {
      ingredient.products.push({
        barcode: input.barcode,
        brand: input.brand || "",
        productName: input.productName || ingredient.name,
        packageQty: purchased.qty,
        packageUnit: normalizeUnit(purchased.unit),
        price: Number(input.price) || 0,
        source: input.productSource || "manual",
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }
  }
}
