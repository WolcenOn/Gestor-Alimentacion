import { getState, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { findWeekByStartDate, getWeekRange, parseIsoDate } from "./state/calendarPeriods.js";
import { showAlert } from "./render/ui.js";

function stop(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
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
    draft.activeWeekId = week.id;
    draft.settings ||= {};
    draft.settings.calendarView = "week";
    if (week.startDate) draft.settings.calendarMonth = week.startDate.slice(0, 7);
  }, "calendar-week-select");
  showAlert("Semana abierta.");
}

function createCalendarWeek(startDate) {
  const date = parseIsoDate(startDate);
  if (!date) throw new Error("No se pudo leer la fecha de esa semana.");
  const range = getWeekRange(date);

  updateState(draft => {
    const existingWeek = findWeekByStartDate(draft.weeks, range.startDate);
    if (existingWeek) {
      draft.activeWeekId = existingWeek.id;
    } else {
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
      draft.activeWeekId = week.id;
    }
    draft.settings ||= {};
    draft.settings.calendarView = "week";
    draft.settings.calendarMonth = range.startDate.slice(0, 7);
  }, "calendar-week-create");
  showAlert("Semana creada y abierta.");
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
}, true);

window.GestorCalendarNavigation = {
  getState,
  setCalendarView,
  setCalendarMonth,
  selectCalendarWeek,
  createCalendarWeek
};
