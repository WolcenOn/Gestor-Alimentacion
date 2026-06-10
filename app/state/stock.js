import { uid, nowIso, toBaseQty, normalizeUnit, formatQty } from "../utils.js";
import { getWeekProgress, setWeekProgress } from "./shoppingProgress.js";
import { validatePurchaseInput } from "../validation.js";
import { registerRecycling } from "./wasteRecycling.js";

export function registerPurchase(state, input) {
  validatePurchaseInput(input);
  const ingredient = state.ingredients.find(i => i.id === input.ingredientId);
  if (!ingredient) throw new Error("Ingrediente no encontrado.");

  const purchased = toBaseQty(input.purchasedQty, input.unit);
  const ingredientBase = toBaseQty(ingredient.qty, ingredient.unit);
  if (ingredientBase.unit !== purchased.unit) throw new Error("No se pueden sumar unidades incompatibles al stock.");

  const packageCount = Number(input.packagingQty) || 0;
  const packageSizeQty = Number(input.packageSizeQty) || (packageCount > 0 ? purchased.qty / packageCount : purchased.qty);
  const packageSizeUnit = normalizeUnit(input.packageSizeUnit || purchased.unit);

  ingredient.qty = ingredientBase.qty + purchased.qty;
  ingredient.unit = ingredientBase.unit;
  ingredient.available = ingredient.qty > 0;
  ingredient.updatedAt = nowIso();

  state.purchaseLots.push({
    id: uid("lot"),
    ingredientId: ingredient.id,
    qty: purchased.qty,
    unit: purchased.unit,
    packageCount,
    packageSizeQty,
    packageSizeUnit,
    barcode: input.barcode || "",
    brand: input.brand || "",
    purchaseDate: input.purchaseDate || new Date().toISOString().slice(0, 10),
    expiryDate: input.expiryDate || "",
    dateType: input.dateType || "none",
    storageType: input.storageType || ingredient.storageType || "pantry",
    source: input.source || "shopping-list",
    createdAt: nowIso(),
    schemaVersion: 2
  });

  state.purchaseEntries.push({
    id: uid("purchase"),
    weekId: input.weekId,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    requiredQty: Number(input.requiredQty) || 0,
    purchasedQty: purchased.qty,
    unit: purchased.unit,
    packageCount,
    packageSizeQty,
    packageSizeUnit,
    barcode: input.barcode || "",
    brand: input.brand || "",
    price: Number(input.price) || 0,
    isPartial: Boolean(input.isPartial),
    packagingType: input.packagingType || "",
    packagingQty: packageCount,
    createdAt: nowIso(),
    schemaVersion: 2
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

  if (packageCount > 0) {
    registerRecycling(state, {
      packagingType: input.packagingType || "otro",
      packagingQty: packageCount,
      source: "purchase",
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      date: input.purchaseDate
    });
  }

  if (input.barcode) {
    ingredient.products ||= [];
    const existing = ingredient.products.find(p => p.barcode === input.barcode);
    const productPayload = {
      barcode: input.barcode,
      brand: input.brand || "",
      productName: input.productName || ingredient.name,
      packageQty: packageSizeQty,
      packageUnit: normalizeUnit(packageSizeUnit),
      packageCount,
      trustedProduct: Boolean(input.trustedProduct || existing?.trustedProduct),
      trustedAt: input.trustedProduct ? nowIso() : existing?.trustedAt,
      lastPurchasedQty: purchased.qty,
      lastPurchasedUnit: purchased.unit,
      price: Number(input.price) || 0,
      source: input.productSource || "manual",
      packagingType: input.packagingType || "otro",
      updatedAt: nowIso()
    };
    if (existing) {
      Object.assign(existing, productPayload);
    } else {
      ingredient.products.push({
        ...productPayload,
        createdAt: nowIso()
      });
    }
  }
}

export function getDishConsumptionKey(slot, dishId) {
  return `${slot}__${dishId}`;
}

export function getDishConsumptionRecords(state, weekId = state.activeWeekId) {
  state.mealConsumptions ||= [];
  return state.mealConsumptions.filter(entry => entry.weekId === weekId);
}

export function getPlannedDishStatus(state, slot, dishId, weekId = state.activeWeekId) {
  const key = getDishConsumptionKey(slot, dishId);
  const active = [...getDishConsumptionRecords(state, weekId)].reverse().find(entry => entry.key === key && ["consumed", "skipped"].includes(entry.status));
  return active?.status || "pending";
}

export function isPlannedDishConsumed(state, slot, dishId, weekId = state.activeWeekId) {
  return getPlannedDishStatus(state, slot, dishId, weekId) === "consumed";
}

export function isPlannedDishSkipped(state, slot, dishId, weekId = state.activeWeekId) {
  return getPlannedDishStatus(state, slot, dishId, weekId) === "skipped";
}

function markActiveRecordsAs(state, weekId, key, nextStatus) {
  state.mealConsumptions ||= [];
  for (const entry of state.mealConsumptions) {
    if (entry.weekId === weekId && entry.key === key && ["consumed", "skipped"].includes(entry.status)) {
      entry.status = nextStatus;
      entry.updatedAt = nowIso();
    }
  }
}

export function consumePlannedDish(state, { weekId = state.activeWeekId, slot, dishId }) {
  state.mealConsumptions ||= [];
  const key = getDishConsumptionKey(slot, dishId);
  const currentStatus = getPlannedDishStatus(state, slot, dishId, weekId);
  if (currentStatus === "consumed") return { alreadyConsumed: true, warnings: [] };
  if (currentStatus === "skipped") markActiveRecordsAs(state, weekId, key, "reopened");

  const dish = state.dishes.find(item => item.id === dishId);
  if (!dish) throw new Error("Plato no encontrado.");

  const consumedLines = [];
  const warnings = [];
  for (const line of dish.recipe || []) {
    const ingredient = state.ingredients.find(item => item.id === line.ingredientId);
    if (!ingredient) {
      warnings.push(`Ingrediente eliminado: ${line.ingredientId}`);
      continue;
    }
    const required = toBaseQty(line.qty, line.unit);
    const stock = toBaseQty(ingredient.qty, ingredient.unit);
    if (required.unit !== stock.unit) {
      warnings.push(`${ingredient.name}: unidad incompatible (${formatQty(line.qty, line.unit)} frente a ${formatQty(ingredient.qty, ingredient.unit)}).`);
      continue;
    }
    const beforeQty = stock.qty;
    const consumedQty = Math.min(stock.qty, required.qty);
    const shortageQty = Math.max(0, required.qty - stock.qty);
    ingredient.qty = Math.max(0, stock.qty - required.qty);
    ingredient.unit = stock.unit;
    ingredient.available = ingredient.qty > 0;
    ingredient.updatedAt = nowIso();
    if (shortageQty > 0) warnings.push(`${ingredient.name}: faltaban ${formatQty(shortageQty, stock.unit)} en stock.`);
    consumedLines.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      requiredQty: required.qty,
      consumedQty,
      beforeQty,
      afterQty: ingredient.qty,
      shortageQty,
      unit: stock.unit
    });
  }

  state.mealConsumptions.push({
    id: uid("meal_consumption"),
    key,
    weekId,
    slot,
    dishId,
    dishName: dish.name,
    status: "consumed",
    consumedAt: nowIso(),
    ingredients: consumedLines,
    warnings,
    schemaVersion: 1
  });

  return { alreadyConsumed: false, warnings };
}

export function skipPlannedDish(state, { weekId = state.activeWeekId, slot, dishId, reason = "not-eaten" }) {
  state.mealConsumptions ||= [];
  const key = getDishConsumptionKey(slot, dishId);
  const currentStatus = getPlannedDishStatus(state, slot, dishId, weekId);
  if (currentStatus === "skipped") return { alreadySkipped: true, restored: false };

  let restored = false;
  if (currentStatus === "consumed") restored = undoPlannedDishConsumption(state, { weekId, slot, dishId }).restored;

  const dish = state.dishes.find(item => item.id === dishId);
  if (!dish) throw new Error("Plato no encontrado.");
  state.mealConsumptions.push({
    id: uid("meal_skip"),
    key,
    weekId,
    slot,
    dishId,
    dishName: dish.name,
    status: "skipped",
    reason,
    skippedAt: nowIso(),
    ingredients: [],
    warnings: [],
    schemaVersion: 1
  });

  return { alreadySkipped: false, restored };
}

export function reopenPlannedDish(state, { weekId = state.activeWeekId, slot, dishId }) {
  const key = getDishConsumptionKey(slot, dishId);
  const currentStatus = getPlannedDishStatus(state, slot, dishId, weekId);
  if (currentStatus === "consumed") {
    const result = undoPlannedDishConsumption(state, { weekId, slot, dishId });
    return { reopened: result.restored, restored: result.restored };
  }
  if (currentStatus === "skipped") {
    markActiveRecordsAs(state, weekId, key, "reopened");
    return { reopened: true, restored: false };
  }
  return { reopened: false, restored: false };
}

export function undoPlannedDishConsumption(state, { weekId = state.activeWeekId, slot, dishId }) {
  state.mealConsumptions ||= [];
  const key = getDishConsumptionKey(slot, dishId);
  const record = [...state.mealConsumptions].reverse().find(entry => entry.weekId === weekId && entry.key === key && entry.status === "consumed");
  if (!record) return { restored: false };

  for (const line of record.ingredients || []) {
    const ingredient = state.ingredients.find(item => item.id === line.ingredientId);
    if (!ingredient) continue;
    const stock = toBaseQty(ingredient.qty, ingredient.unit);
    if (stock.unit !== line.unit) continue;
    ingredient.qty = stock.qty + Number(line.consumedQty || 0);
    ingredient.unit = stock.unit;
    ingredient.available = ingredient.qty > 0;
    ingredient.updatedAt = nowIso();
  }

  record.status = "undone";
  record.undoneAt = nowIso();
  return { restored: true };
}
