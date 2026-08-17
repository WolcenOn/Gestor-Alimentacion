import { getState, updateState } from "./store.js";
import { stripDangerousText } from "./utils.js";

let pendingManualDish = null;

function uniqueMealTypes(values) {
  return [...new Set(values.map(value => stripDangerousText(String(value || "").trim())).filter(Boolean))];
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
