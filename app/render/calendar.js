import { DAYS, escapeHtml } from "../utils.js";

export function renderCalendar(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  if (!week) return `<article class="card"><h2>No hay semana activa</h2><button data-action="new-week">Crear semana</button></article>`;
  return `
    <div class="card-header calendar-topbar">
      <div>
        <p class="eyebrow">Planificación semanal</p>
        <h2>${escapeHtml(week.name)}</h2>
        <p class="muted">Asigna varios platos por persona, comida y día. Configura miembros y comidas desde Ajustes.</p>
      </div>
      <div class="actions toolbar-actions">
        <button class="secondary" data-action="new-week">Nueva</button>
        <button class="secondary" data-action="duplicate-week">Duplicar</button>
        <button class="secondary" data-action="clear-week">Limpiar</button>
        <button data-action="print-week">Imprimir</button>
      </div>
    </div>

    <div class="week-mobile-grid">
      ${DAYS.map(day => renderDayCard(state, week, day)).join("")}
    </div>
  `;
}

function renderDayCard(state, week, day) {
  return `
    <article class="day-card">
      <header class="day-card-header">
        <h3>${escapeHtml(capitalize(day))}</h3>
      </header>
      <div class="day-meals">
        ${state.mealTypes.map(meal => renderMealBlock(state, week, day, meal)).join("")}
      </div>
    </article>
  `;
}

function renderMealBlock(state, week, day, meal) {
  return `
    <section class="meal-block">
      <div class="meal-block-title">${escapeHtml(meal.name)}</div>
      <div class="member-slots">
        ${state.familyMembers.map(member => renderMemberSlot(state, week, day, meal, member)).join("")}
      </div>
    </section>
  `;
}

function renderMemberSlot(state, week, day, meal, member) {
  const key = `${day}__${meal.id}__${member.id}`;
  const planned = week.plan[key] || [];
  return `
    <div class="member-slot">
      <div class="member-slot-head">
        <strong>${escapeHtml(member.name)}</strong>
        <span class="mini-badge">${planned.length}</span>
      </div>
      <div class="dish-stack">
        ${planned.length ? planned.map(dishId => renderDishPill(state, key, dishId)).join("") : `<p class="empty-slot">Sin platos asignados</p>`}
      </div>
      <label class="add-dish-label">Añadir plato
        <select data-action="add-dish-to-slot" data-slot="${escapeHtml(key)}">
          <option value="">Seleccionar plato</option>
          ${renderDishOptionsByCategory(state.dishes)}
        </select>
      </label>
    </div>
  `;
}

function renderDishOptionsByCategory(dishes) {
  const grouped = new Map();
  const normalizedDishes = [...dishes].sort(compareDishByCategoryAndName);

  for (const dish of normalizedDishes) {
    const category = normalizeCategory(dish.category);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(dish);
  }

  return [...grouped.entries()].map(([category, categoryDishes]) => `
    <optgroup label="${escapeHtml(category)}">
      ${categoryDishes.map(dish => `<option value="${escapeHtml(dish.id)}">${escapeHtml(dish.name)}</option>`).join("")}
    </optgroup>
  `).join("");
}

function compareDishByCategoryAndName(a, b) {
  return normalizeCategory(a.category).localeCompare(normalizeCategory(b.category), "es", { sensitivity: "base" })
    || String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
}

function normalizeCategory(category) {
  const value = String(category || "").trim();
  return value ? capitalize(value) : "Sin categoría";
}

function renderDishPill(state, key, dishId) {
  const dish = state.dishes.find(d => d.id === dishId);
  return `
    <span class="dish-pill">
      <span>${escapeHtml(dish?.name || "Plato eliminado")}</span>
      <button class="ghost icon-button" aria-label="Quitar plato" data-action="remove-dish-from-slot" data-slot="${escapeHtml(key)}" data-dish-id="${escapeHtml(dishId)}">×</button>
    </span>
  `;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
