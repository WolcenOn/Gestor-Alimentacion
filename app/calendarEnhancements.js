import { updateState } from "./store.js";
import { withMeta } from "./models.js";
import { showAlert } from "./render/ui.js";
import { getWeekRange, parseIsoDate, parseMonthKey } from "./state/calendarPeriods.js";

function stop(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function createWeekFromStartDate(startDate) {
  const date = parseIsoDate(startDate);
  if (!date) throw new Error("Fecha de semana no válida.");
  const range = getWeekRange(date);
  return withMeta({
    id: range.id,
    name: range.name,
    startDate: range.startDate,
    endDate: range.endDate,
    isTypical: false,
    plan: {}
  }, "week");
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  try {
    if (button.dataset.action === "calendar-view") {
      stop(event);
      const nextView = button.dataset.calendarView === "month" ? "month" : "week";
      updateState(draft => {
        draft.settings ||= {};
        draft.settings.calendarView = nextView;
        const activeWeek = draft.weeks.find(week => week.id === draft.activeWeekId);
        if (activeWeek?.startDate) draft.settings.calendarMonth = activeWeek.startDate.slice(0, 7);
      }, "calendar-view");
    }

    if (button.dataset.action === "calendar-month") {
      stop(event);
      const month = parseMonthKey(button.dataset.month);
      updateState(draft => {
        draft.settings ||= {};
        draft.settings.calendarView = "month";
        draft.settings.calendarMonth = month;
      }, "calendar-month");
    }

    if (button.dataset.action === "select-calendar-week") {
      stop(event);
      const weekId = button.dataset.weekId;
      updateState(draft => {
        const week = draft.weeks.find(item => item.id === weekId);
        if (!week) throw new Error("Semana no encontrada.");
        draft.activeWeekId = week.id;
        draft.settings ||= {};
        draft.settings.calendarView = "week";
        if (week.startDate) draft.settings.calendarMonth = week.startDate.slice(0, 7);
      }, "calendar-select-week");
    }

    if (button.dataset.action === "create-calendar-week") {
      stop(event);
      const startDate = button.dataset.startDate;
      const week = createWeekFromStartDate(startDate);
      updateState(draft => {
        const existing = draft.weeks.find(item => item.startDate === week.startDate);
        if (existing) {
          draft.activeWeekId = existing.id;
        } else {
          draft.weeks.push(week);
          draft.activeWeekId = week.id;
        }
        draft.settings ||= {};
        draft.settings.calendarView = "week";
        draft.settings.calendarMonth = week.startDate.slice(0, 7);
      }, "calendar-create-week");
      showAlert("Semana creada. Ya puedes editarla con detalle.");
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo actualizar la planificación.", "error");
  }
}, true);
