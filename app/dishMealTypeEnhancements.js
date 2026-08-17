import { getState, updateState } from "./store.js";
import { stripDangerousText } from "./utils.js";

let pendingManualDish = null;
let legacyMigrationDone = false;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function uniqueMealTypes(values) {
  return [...new Set(values.map(value => stripDangerousText(String(value || "").trim())).filter(Boolean))];
}

function mealAliases(meal) {
  const text = normalize(`${meal.id || ""} ${meal.name || ""}`);
  const aliases = [normalize(meal.name), normalize(meal.id)].filter(Boolean);
  if (/desay|breakfast/.test(text)) aliases.push("desayuno", "breakfast");
  if (/meriend|snack/.test(text)) aliases.push("merienda", "snack");
  if (/cen|dinner/.test(text)) aliases.push("cena", "dinner");
  if (/comida|almuerzo|lunch/.test(text)) aliases.push("comida", "almuerzo", "lunch");
  return [...new Set(aliases)].filter(value => value.length > 2);
}

function inferConfiguredMeals(state, dish) {
  const category = normalize(dish.category);
  if (!category) return [];
  return (state.mealTypes || []).filter(meal => {
    return mealAliases(meal).some(alias => category === alias || category.startsWith(`${alias} `) || category.endsWith(` ${alias}`));
  }).map(meal => meal.name);
}

function migrateLegacyMealTypes() {
  if (legacyMigrationDone) return;
  legacyMigrationDone = true;
  const state = getState();
  const pending = state.dishes
    .filter(dish => !Array.isArray(dish.mealTypes) || !dish.mealTypes.length)
    .map(dish => ({ id: dish.id, mealTypes: inferConfiguredMeals(state, dish) }))
    .filter(item => item.mealTypes.length);
  if (!pending.length) return;

  updateState(draft => {
    pending.forEach(item => {
      const dish = draft.dishes.find(entry => entry.id === item.id);
      if (!dish || (Array.isArray(dish.mealTypes) && dish.mealTypes.length)) return;
      dish.mealTypes = uniqueMealTypes(item.mealTypes);
      dish.updatedAt = new Date().toISOString();
    });
  }, "dish-meal-types-migration");
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="dish"]');
  if (!form) return;

  pendingManualDish = {
    existingIds: new Set(getState().dishes.map(dish => dish.id)),
    mealTypes: uniqueMealTypes(new FormData(form).getAll("mealTypes"))
  };

  window.setTimeout(() => {
    const pending = pendingManualDish;
    pendingManualDish = null;
    if (!pending) return;

    const state = getState();
    const created = [...state.dishes].reverse().find(dish => !pending.existingIds.has(dish.id));
    if (!created) return;

    updateState(draft => {
      const dish = draft.dishes.find(item => item.id === created.id);
      if (!dish) return;
      dish.mealTypes = pending.mealTypes;
      dish.updatedAt = new Date().toISOString();
    }, "dish-meal-types");
  }, 0);
}, true);

window.addEventListener("load", migrateLegacyMealTypes);
window.setTimeout(migrateLegacyMealTypes, 0);
