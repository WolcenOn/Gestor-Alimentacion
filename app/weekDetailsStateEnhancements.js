const STORAGE_KEY = "gestorMenuSemanal.weekPlannerFocus.v2";

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeState(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore private browsing or storage quota errors.
  }
}

function getFocus(weekId) {
  const state = readState();
  return state[weekId] || null;
}

function setFocus(weekId, patch) {
  if (!weekId) return;
  const state = readState();
  state[weekId] = { ...(state[weekId] || {}), ...patch };
  writeState(state);
}

function closeOtherDays(activeDay) {
  const root = activeDay.closest("[data-week-planner-root]");
  if (!root) return;
  root.querySelectorAll("[data-week-day-details]").forEach(day => {
    if (day !== activeDay) day.open = false;
  });
}

function closeOtherMeals(activeMeal) {
  const day = activeMeal.closest("[data-week-day-details]");
  if (!day) return;
  day.querySelectorAll("[data-week-meal-details]").forEach(meal => {
    if (meal !== activeMeal) meal.open = false;
  });
}

function rememberDay(details) {
  const weekId = details.dataset.weekId || "";
  const day = details.dataset.day || "";
  if (!weekId || !day) return;

  if (details.open) {
    closeOtherDays(details);
    setFocus(weekId, { day });
  } else {
    const focus = getFocus(weekId);
    if (focus?.day === day) setFocus(weekId, { day: "", mealId: "" });
  }
}

function rememberMeal(details) {
  const weekId = details.dataset.weekId || "";
  const day = details.dataset.day || "";
  const mealId = details.dataset.mealId || "";
  if (!weekId || !day || !mealId) return;

  if (details.open) {
    const dayDetails = details.closest("[data-week-day-details]");
    if (dayDetails) {
      dayDetails.open = true;
      closeOtherDays(dayDetails);
    }
    closeOtherMeals(details);
    setFocus(weekId, { day, mealId });
  } else {
    const focus = getFocus(weekId);
    if (focus?.day === day && focus?.mealId === mealId) setFocus(weekId, { mealId: "" });
  }
}

function restorePlannerFocus(root = document) {
  root.querySelectorAll("[data-week-planner-root]").forEach(planner => {
    const weekId = planner.dataset.weekId || "";
    if (!weekId) return;
    const focus = getFocus(weekId);
    if (!focus?.day) return;

    const activeDay = [...planner.querySelectorAll("[data-week-day-details]")]
      .find(day => day.dataset.day === focus.day);
    if (!activeDay) return;

    planner.querySelectorAll("[data-week-day-details]").forEach(day => {
      day.open = day === activeDay;
    });

    const meals = [...activeDay.querySelectorAll("[data-week-meal-details]")];
    if (!focus.mealId) {
      meals.forEach(meal => { meal.open = false; });
      return;
    }

    const activeMeal = meals.find(meal => meal.dataset.mealId === focus.mealId);
    meals.forEach(meal => { meal.open = meal === activeMeal; });
  });
}

function rememberSlotContext(button) {
  const slot = button?.dataset?.slot || "";
  const [day, mealId] = slot.split("__");
  const planner = button?.closest("[data-week-planner-root]");
  const weekId = planner?.dataset.weekId || button?.closest("[data-week-day-details]")?.dataset.weekId || "";
  if (!weekId || !day || !mealId) return;
  setFocus(weekId, { day, mealId });
}

document.addEventListener("toggle", event => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement)) return;

  if (details.matches("[data-week-day-details]")) {
    rememberDay(details);
    return;
  }

  if (details.matches("[data-week-meal-details]")) rememberMeal(details);
}, true);

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="open-dish-picker"], [data-action="open-week-ingredient-picker"]');
  if (!button) return;
  rememberSlotContext(button);
}, true);

const observer = new MutationObserver(mutations => {
  const hasPlannerChanges = mutations.some(mutation =>
    [...mutation.addedNodes].some(node =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node.matches?.("[data-week-planner-root]") || node.querySelector?.("[data-week-planner-root]"))
    )
  );
  if (hasPlannerChanges) requestAnimationFrame(() => restorePlannerFocus());
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", () => restorePlannerFocus());
requestAnimationFrame(() => restorePlannerFocus());

window.__gestorWeekDetailsState = {
  restoreOpenDetails: restorePlannerFocus,
  restorePlannerFocus,
  rememberSlotContext
};
