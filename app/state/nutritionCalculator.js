import { DAYS } from "../utils.js";

export const NUTRIENTS = [
  ["kcal", "kcal"],
  ["protein", "Proteína"],
  ["carbs", "Hidratos"],
  ["fat", "Grasas"],
  ["fiber", "Fibra"],
  ["sugar", "Azúcares"],
  ["salt", "Sal"],
  ["sodium", "Sodio"]
];

export function emptyNutrition() {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0, sodium: 0 };
}

export function addNutrition(target, source, factor = 1) {
  for (const [key] of NUTRIENTS) target[key] = Number(target[key] || 0) + Number(source?.[key] || 0) * factor;
  return target;
}

function unitFactor(qty, unit, profile) {
  const amount = Number(qty || 0);
  const lineUnit = String(unit || "g").toLowerCase();
  const profilePer = Number(profile?.per || 100) || 100;
  const profileUnit = String(profile?.unit || "g").toLowerCase();

  if (["g", "ml"].includes(lineUnit)) return amount / profilePer;
  if (lineUnit === "kg") return (amount * 1000) / profilePer;
  if (lineUnit === "l") return (amount * 1000) / profilePer;
  if (lineUnit === "unidades") return amount;
  if (profileUnit === lineUnit) return amount / profilePer;
  return amount / profilePer;
}

export function getIngredientProfile(state, ingredientId) {
  return state.nutritionProfiles.find(profile => profile.ingredientId === ingredientId) || null;
}

export function computeIngredientNutrition(state, ingredientId, qty = 100, unit = "g") {
  const profile = getIngredientProfile(state, ingredientId);
  const total = emptyNutrition();
  if (!profile) return { total, missing: [ingredientId], hasProfile: false };
  addNutrition(total, profile, unitFactor(qty, unit, profile));
  return { total, missing: [], hasProfile: true };
}

export function computeDishNutrition(state, dishId) {
  const dish = state.dishes.find(item => item.id === dishId);
  const total = emptyNutrition();
  const missing = [];
  if (!dish) return { dish: null, total, missing: [dishId] };

  for (const line of dish.recipe || []) {
    const profile = getIngredientProfile(state, line.ingredientId);
    if (!profile) {
      missing.push(line.ingredientId);
      continue;
    }
    addNutrition(total, profile, unitFactor(line.qty, line.unit, profile));
  }

  return { dish, total, missing };
}

export function computeWeekNutrition(state, weekId = state.activeWeekId) {
  const week = state.weeks.find(item => item.id === weekId);
  const result = {
    week,
    byMember: {},
    byDay: {},
    byMemberDay: {},
    totals: emptyNutrition(),
    missingIngredientIds: new Set()
  };
  if (!week) return result;

  for (const member of state.familyMembers) {
    result.byMember[member.id] = { member, total: emptyNutrition(), days: {}, monthEstimate: emptyNutrition(), missingIngredientIds: new Set() };
  }
  for (const day of DAYS) result.byDay[day] = emptyNutrition();

  for (const [slot, dishIds] of Object.entries(week.plan || {})) {
    const [day, mealId, memberId] = slot.split("__");
    const memberBucket = result.byMember[memberId];
    if (!memberBucket) continue;
    memberBucket.days[day] ||= emptyNutrition();
    result.byMemberDay[`${memberId}__${day}`] ||= emptyNutrition();

    for (const dishId of dishIds || []) {
      const dishNutri = computeDishNutrition(state, dishId);
      addNutrition(result.totals, dishNutri.total);
      addNutrition(result.byDay[day], dishNutri.total);
      addNutrition(memberBucket.total, dishNutri.total);
      addNutrition(memberBucket.days[day], dishNutri.total);
      addNutrition(result.byMemberDay[`${memberId}__${day}`], dishNutri.total);
      for (const id of dishNutri.missing) {
        result.missingIngredientIds.add(id);
        memberBucket.missingIngredientIds.add(id);
      }
    }
  }

  for (const memberBucket of Object.values(result.byMember)) {
    addNutrition(memberBucket.monthEstimate, memberBucket.total, 30 / 7);
  }

  return result;
}

export function formatNutritionValue(key, value) {
  const n = Number(value || 0);
  if (key === "kcal") return `${Math.round(n).toLocaleString("es-ES")} kcal`;
  if (key === "sodium") return `${n.toFixed(n < 1 ? 3 : 1)} g`;
  return `${n.toFixed(n < 10 ? 1 : 0)} g`;
}

export function missingIngredientNames(state, ids) {
  return [...ids].map(id => state.ingredients.find(ingredient => ingredient.id === id)?.name || id);
}
