import { DAYS, escapeHtml } from "../utils.js";

export function renderPrintWeekView(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  if (!week) return `<h1>Sin semana activa</h1>`;
  return `
    <h1>${escapeHtml(week.name)}</h1>
    <table>
      <thead><tr><th>Día</th>${state.mealTypes.map(meal => `<th>${escapeHtml(meal.name)}</th>`).join("")}</tr></thead>
      <tbody>
        ${DAYS.map(day => `<tr><th>${escapeHtml(capitalize(day))}</th>${state.mealTypes.map(meal => `<td>${renderPrintMealCell(state, week, day, meal)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderPrintMealCell(state, week, day, meal) {
  const chunks = state.familyMembers.map(member => {
    const key = `${day}__${meal.id}__${member.id}`;
    const dishIds = week.plan[key] || [];
    if (!dishIds.length) return "";
    const dishes = dishIds.map(id => escapeHtml(state.dishes.find(d => d.id === id)?.name || "Plato eliminado")).join(", ");
    return `<strong>${escapeHtml(member.name)}:</strong> ${dishes}`;
  }).filter(Boolean);
  return chunks.join("<br>");
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function printWeek(state) {
  document.body.dataset.printMode = "week";
  document.getElementById("printWeekView").innerHTML = renderPrintWeekView(state);
  window.print();
}
