import { getState, subscribe, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { findWeekByStartDate, getWeekRange, parseIsoDate } from "./state/calendarPeriods.js";
import { showAlert } from "./render/ui.js";

const AUTO_SYNC_REASONS = new Set(["cloud-pull", "import", "reset", "load", "calendar-autofix", "calendar-autofix-startup", "calendar-autofix-after-cloud"]);
let syncingCurrentWeek = false;

function stop(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function isGeneratedWeekName(name = "") {
  const value = String(name || "").trim().toLowerCase();
  return !value || value.includes("copia") || /^semana\s+\d{1,2}\b/.test(value) || value === "nueva semana";
}

function normalizeWeekMetadata(week, range) {
  week.startDate = range.startDate;
  week.endDate = range.endDate;
  if (isGeneratedWeekName(week.name)) week.name = range.name;
  week.plan ||= {};
  week.ingredientPlan ||= {};
  week.updatedAt = new Date().toISOString();
  return week;
}

function ensureWeekForRange(draft, range) {
  const existingWeek = findWeekByStartDate(draft.weeks, range.startDate);
  if (existingWeek) return normalizeWeekMetadata(existingWeek, range);

  const week = withMeta({
    id: range.id,
    name: range.name,
    startDate: range.startDate,
    endDate: range.endDate,
    isTypical: false,
    plan: {},
    ingredientPlan: {}
  }, "week");
  draft.weeks.push(week);
  return week;
}

function applyActiveWeek(draft, week, { view = "week" } = {}) {
  draft.activeWeekId = week.id;
  draft.settings ||= {};
  draft.settings.calendarView = view;
  if (week.startDate) draft.settings.calendarMonth = week.startDate.slice(0, 7);
}

function setCalendarView(view) {
  updateState(draft => {
    draft.settings ||= {};
    draft.settings.calendarView = view === "month" ? "month" : "week";
    const activeWeek = draft.weeks.find(week => week.id === draft.activeWeekId);
    if (activeWeek?.startDate) draft.settings.calendarMonth = activeWeek.startDate.slice(0, 7);
  }, "calendar-view");
}

function setCalendarMonth(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return;
  updateState(draft => {
    draft.settings ||= {};
    draft.settings.calendarView = "month";
    draft.settings.calendarMonth = monthKey;
  }, "calendar-month");
}

function selectCalendarWeek(weekId) {
  updateState(draft => {
    const week = draft.weeks.find(item => item.id === weekId);
    if (!week) throw new Error("No se encontró esa semana.");
    applyActiveWeek(draft, week);
  }, "calendar-week-select");
  showAlert("Semana abierta.");
}

function createCalendarWeek(startDate) {
  const date = parseIsoDate(startDate);
  if (!date) throw new Error("No se pudo leer la fecha de esa semana.");
  const range = getWeekRange(date);

  updateState(draft => {
    const week = ensureWeekForRange(draft, range);
    applyActiveWeek(draft, week);
  }, "calendar-week-create");
  showAlert("Semana creada y abierta.");
}

function duplicateIntoCurrentWeek() {
  const range = getWeekRange();
  let created = false;
  updateState(draft => {
    const source = draft.weeks.find(week => week.id === draft.activeWeekId) || draft.weeks[0];
    if (!source) throw new Error("No hay una semana para duplicar.");

    const existingCurrent = findWeekByStartDate(draft.weeks, range.startDate);
    if (existingCurrent && existingCurrent.id !== source.id) {
      existingCurrent.plan = structuredClone(source.plan || {});
      existingCurrent.ingredientPlan = structuredClone(source.ingredientPlan || {});
      normalizeWeekMetadata(existingCurrent, range);
      applyActiveWeek(draft, existingCurrent);
      return;
    }

    const copy = withMeta({
      id: existingCurrent?.id === source.id ? `${range.id}_copy_${Date.now()}` : range.id,
      name: existingCurrent?.id === source.id ? `${range.name} copia` : range.name,
      startDate: range.startDate,
      endDate: range.endDate,
      isTypical: false,
      plan: structuredClone(source.plan || {}),
      ingredientPlan: structuredClone(source.ingredientPlan || {})
    }, "week");
    draft.weeks.push(copy);
    applyActiveWeek(draft, copy);
    created = true;
  }, "duplicate-week-current-range");
  showAlert(created ? "Semana duplicada con la fecha actual." : "Semana actual actualizada con la planificación duplicada.");
}

function openCurrentWeek({ notify = false, reason = "calendar-current-week" } = {}) {
  const range = getWeekRange();
  let changed = false;

  syncingCurrentWeek = true;
  try {
    updateState(draft => {
      const week = ensureWeekForRange(draft, range);
      changed = draft.activeWeekId !== week.id || draft.settings?.calendarMonth !== range.startDate.slice(0, 7) || isGeneratedWeekName(week.name);
      applyActiveWeek(draft, week, { view: draft.settings?.calendarView || "week" });
      draft.settings.currentWeekAutoSelectedAt = new Date().toISOString();
    }, reason);
  } finally {
    syncingCurrentWeek = false;
  }

  if (notify && changed) showAlert("Semana actual abierta.");
}

function shouldAutoOpenCurrentWeek(state) {
  const currentRange = getWeekRange();
  const activeWeek = state.weeks.find(week => week.id === state.activeWeekId);
  if (!activeWeek) return true;
  if (activeWeek.startDate !== currentRange.startDate) return true;
  return isGeneratedWeekName(activeWeek.name) && activeWeek.name !== currentRange.name;
}

function syncCurrentWeek({ reason = "calendar-autofix" } = {}) {
  if (syncingCurrentWeek) return;
  const state = getState();
  if (!shouldAutoOpenCurrentWeek(state)) return;
  openCurrentWeek({ reason });
}

function syncCurrentWeekSoon(reason = "calendar-autofix") {
  window.setTimeout(() => syncCurrentWeek({ reason }), 0);
  window.setTimeout(() => syncCurrentWeek({ reason }), 900);
  window.setTimeout(() => syncCurrentWeek({ reason }), 2500);
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "calendar-view") {
    stop(event);
    setCalendarView(button.dataset.calendarView);
  }
  if (action === "calendar-month") {
    stop(event);
    setCalendarMonth(button.dataset.month);
  }
  if (action === "select-calendar-week") {
    stop(event);
    selectCalendarWeek(button.dataset.weekId);
  }
  if (action === "create-calendar-week") {
    stop(event);
    createCalendarWeek(button.dataset.startDate);
  }
  if (action === "open-current-week") {
    stop(event);
    openCurrentWeek({ notify: true });
  }
  if (action === "duplicate-week") {
    stop(event);
    duplicateIntoCurrentWeek();
  }
}, true);

subscribe((_, reason) => {
  if (syncingCurrentWeek) return;
  if (AUTO_SYNC_REASONS.has(reason)) syncCurrentWeekSoon(reason === "cloud-pull" ? "calendar-autofix-after-cloud" : "calendar-autofix");
});

syncCurrentWeekSoon("calendar-autofix-startup");
window.addEventListener("load", () => syncCurrentWeekSoon("calendar-autofix-load"));
window.addEventListener("focus", () => syncCurrentWeekSoon("calendar-autofix-focus"));
window.addEventListener("online", () => syncCurrentWeekSoon("calendar-autofix-online"));

window.GestorCalendarNavigation = {
  getState,
  setCalendarView,
  setCalendarMonth,
  selectCalendarWeek,
  createCalendarWeek,
  duplicateIntoCurrentWeek,
  openCurrentWeek,
  syncCurrentWeek
};
