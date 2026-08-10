import { formatQty, toBaseQty, areCompatibleUnits } from "../utils.js";

export function getProgressKey(weekId) { return `shoppingPurchaseProgress:${weekId}`; }

export function getWeekProgress(state, weekId = state.activeWeekId) {
  return state.shoppingProgress[getProgressKey(weekId)] || {};
}

export function setWeekProgress(state, weekId, progress) {
  state.shoppingProgress[getProgressKey(weekId)] = progress;
}

function addNeededLine(totals, ingredient, ingredientId, qty, unit) {
  const base = toBaseQty(qty, unit);
  const previous = totals.get(ingredientId);
  if (previous && previous.unit !== base.unit) return;
  totals.set(ingredientId, {
    ingredientId,
    name: ingredient.name,
    familyId: ingredient.familyId,
    neededQty: (previous?.neededQty || 0) + base.qty,
    unit: base.unit
  });
}

export function computeNeededByIngredient(state, weekId = state.activeWeekId) {
  const week = state.weeks.find(w => w.id === weekId);
  const dishMap = new Map(state.dishes.map(d => [d.id, d]));
  const ingredientMap = new Map(state.ingredients.map(i => [i.id, i]));
  const totals = new Map();
  if (!week) return [];

  for (const dishIds of Object.values(week.plan || {})) {
    for (const dishId of dishIds) {
      const dish = dishMap.get(dishId);
      if (!dish) continue;
      for (const line of dish.recipe || []) {
        const ingredient = ingredientMap.get(line.ingredientId);
        if (!ingredient) continue;
        addNeededLine(totals, ingredient, line.ingredientId, line.qty, line.unit);
      }
    }
  }

  for (const lines of Object.values(week.ingredientPlan || {})) {
    for (const line of lines || []) {
      const ingredient = ingredientMap.get(line.ingredientId);
      if (!ingredient) continue;
      addNeededLine(totals, ingredient, line.ingredientId, line.qty, line.unit || ingredient.unit);
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function computeShoppingListWithProgress(state, weekId = state.activeWeekId) {
  const progress = getWeekProgress(state, weekId);
  return computeNeededByIngredient(state, weekId).map(item => {
    const ingredient = state.ingredients.find(i => i.id === item.ingredientId);
    const stockBase = ingredient && areCompatibleUnits(ingredient.unit, item.unit) ? toBaseQty(ingredient.qty, ingredient.unit).qty : 0;
    const missingQty = Math.max(item.neededQty - stockBase, 0);
    const progressLine = progress[item.ingredientId] || { purchasedQty: 0, unit: item.unit, status: "pending" };
    const purchasedBase = areCompatibleUnits(progressLine.unit, item.unit) ? toBaseQty(progressLine.purchasedQty, progressLine.unit).qty : 0;
    const skipped = progressLine.status === "skipped";
    const remainingQty = skipped ? 0 : Math.max(missingQty - purchasedBase, 0);
    const status = skipped ? "skipped" : remainingQty === 0 ? "done" : purchasedBase > 0 ? "partial" : "pending";
    return {
      ...item,
      stockQty: stockBase,
      missingQty,
      purchasedQty: purchasedBase,
      remainingQty,
      status,
      skipped,
      display: {
        needed: formatQty(item.neededQty, item.unit),
        stock: formatQty(stockBase, item.unit),
        missing: formatQty(missingQty, item.unit),
        purchased: formatQty(purchasedBase, item.unit),
        remaining: formatQty(remainingQty, item.unit)
      }
    };
  });
}

export function skipShoppingItem(state, ingredientId, weekId = state.activeWeekId) {
  const progress = getWeekProgress(state, weekId);
  const existing = progress[ingredientId] || { requiredQty: 0, purchasedQty: 0, unit: "g", status: "pending" };
  progress[ingredientId] = { ...existing, status: "skipped", skippedAt: new Date().toISOString() };
  setWeekProgress(state, weekId, progress);
}

export function reopenShoppingItem(state, ingredientId, weekId = state.activeWeekId) {
  const progress = getWeekProgress(state, weekId);
  const existing = progress[ingredientId];
  if (!existing) return;
  progress[ingredientId] = { ...existing, status: Number(existing.purchasedQty || 0) > 0 ? "partial" : "pending", reopenedAt: new Date().toISOString() };
  setWeekProgress(state, weekId, progress);
}
