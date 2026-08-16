import { getState } from "./store.js";
import { addDays, getWeekRange, parseIsoDate } from "./state/calendarPeriods.js";

function findWeekByStartDate(weeks, startDate) {
  return (weeks || []).find(week => week.startDate === startDate) || null;
}

function formatRange(range) {
  return range.name.replace(/^Semana\s+/i, "");
}

function buildButton(direction, range, existing) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = existing ? "secondary ux-week-jump" : "ux-week-jump ux-week-create";
  if (existing) {
    button.dataset.action = "select-calendar-week";
    button.dataset.weekId = existing.id;
    button.textContent = direction === "prev" ? `← ${formatRange(range)}` : `${formatRange(range)} →`;
    button.setAttribute("aria-label", direction === "prev" ? "Abrir semana anterior" : "Abrir semana siguiente");
  } else {
    button.dataset.action = "create-calendar-week";
    button.dataset.startDate = range.startDate;
    button.textContent = direction === "prev" ? `← Crear ${formatRange(range)}` : `Crear ${formatRange(range)} →`;
    button.setAttribute("aria-label", direction === "prev" ? "Crear semana anterior" : "Crear semana siguiente");
  }
  return button;
}

function enhanceWeekNavigation() {
  const root = document.querySelector("[data-week-planner-root]");
  const toolbar = document.querySelector(".calendar-week-toolbar");
  if (!root || !toolbar) return;

  const weekId = root.dataset.weekId || "";
  const state = getState();
  const activeWeek = state.weeks.find(week => week.id === weekId) || state.weeks.find(week => week.id === state.activeWeekId);
  if (!activeWeek?.startDate) return;

  const start = parseIsoDate(activeWeek.startDate);
  if (!start) return;

  let nav = toolbar.querySelector(".ux-week-quick-nav");
  if (!nav) {
    nav = document.createElement("div");
    nav.className = "ux-week-quick-nav";
    toolbar.append(nav);
  }

  const prevRange = getWeekRange(addDays(start, -7));
  const nextRange = getWeekRange(addDays(start, 7));
  const prevWeek = findWeekByStartDate(state.weeks, prevRange.startDate);
  const nextWeek = findWeekByStartDate(state.weeks, nextRange.startDate);

  nav.replaceChildren(
    buildButton("prev", prevRange, prevWeek),
    buildButton("next", nextRange, nextWeek)
  );
}

let frame = 0;
function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    enhanceWeekNavigation();
  });
}

const observer = new MutationObserver(schedule);
observer.observe(document.getElementById("viewRoot") || document.body, { childList: true, subtree: true });
window.addEventListener("load", schedule);
schedule();
