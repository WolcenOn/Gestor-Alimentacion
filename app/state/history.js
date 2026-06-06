import { uid, nowIso } from "../utils.js";
import { computeShoppingListWithProgress } from "./shoppingProgress.js";

export function createWeeklySnapshot(state, weekId = state.activeWeekId) {
  const shopping = computeShoppingListWithProgress(state, weekId);
  const estimatedCost = shopping.reduce((sum, item) => {
    const ingredient = state.ingredients.find(i => i.id === item.ingredientId);
    return sum + item.remainingQty * (Number(ingredient?.approxPrice) || 0);
  }, 0);
  const snapshot = {
    id: uid("snapshot"),
    weekId,
    createdAt: nowIso(),
    estimatedCost,
    wasteRiskCount: getExpiringIngredients(state, 7).length,
    wasteRiskValue: 0,
    shoppingByFamily: {},
    nutritionSummary: {},
    purchaseSummary: {}
  };
  state.historySnapshots.push(snapshot);
  return snapshot;
}

export function getExpiringIngredients(state, days = 7) {
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return state.ingredients.filter(i => {
    if (!i.expiryDate) return false;
    const date = new Date(i.expiryDate);
    return date >= now && date <= limit;
  });
}
