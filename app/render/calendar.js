import { DAYS, escapeHtml } from "../utils.js";
import { addMonths, buildMonthWeeks, countPlannedSlots, findWeekByStartDate, getMonthKey, hasPlannedSlots, monthLabel } from "../state/calendarPeriods.js";

export function renderCalendar(state) {
  const view = state.settings?.calendarView || "week";
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const activeMonth = state.settings?.calendarMonth || week?.startDate?.slice(0, 7) || getMonthKey();

  return `
    <div class="card-header calendar-topbar">
      <div>
        <p class="eyebrow">Planificación</p>
        <h2>${view === "month" ? `Vista mensual · ${escapeHtml(monthLabel(activeMonth))}` : escapeHtml(week?.name || "Sin semana activa")}</h2>
        <p class="muted">Cambia entre vista mensual para navegar y vista semanal para editar con detalle.</p>
      </div>
      <div class="actions toolbar-actions">
        <button class="${view === "week" ? "" : "secondary"}" data-action="calendar-view" data-calendar-view="week">Semana</button>
        <button class="${view === "month" ? "" : "secondary"}" data-action="calendar-view" data-calendar-view="month">Mes</button>
      </div>
    </div>
    ${view === "month" ? renderMonthView(state, activeMonth) : renderWeekView(state, week)}
  `;
}

function renderWeekView(state, week) {
  if (!week) return `<article class="card"><h2>No hay semana activa</h2><button data-action="new-week">Crear semana</button></article>`;
  return `
    <div class="card calendar-week-toolbar">
      <div>
        <strong>${escapeHtml(week.name)}</strong>
        <p class="muted">${escapeHtml(week.startDate || "")} ${week.endDate ? `→ ${escapeHtml(week.endDate)}` : ""}</p>
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

function renderMonthView(state, monthKey) {
  const weeks = buildMonthWeeks(monthKey);
  return `
    <article class="card calendar-month-card">
      <div class="section-title-row">
        <div>
          <h3>${escapeHtml(monthLabel(monthKey))}</h3>
          <p class="muted">Pulsa una semana para abrirla en vista semanal o créala si todavía no existe.</p>
        </div>
        <div class="actions toolbar-actions">
          <button class="secondary" data-action="calendar-month" data-month="${escapeHtml(addMonths(monthKey, -1))}">← Mes anterior</button>
          <button class="secondary" data-action="calendar-month" data-month="${escapeHtml(getMonthKey())}">Hoy</button>
          <button class="secondary" data-action="calendar-month" data-month="${escapeHtml(addMonths(monthKey, 1))}">Mes siguiente →</button>
        </div>
      </div>
      <div class="calendar-month-grid" role="grid" aria-label="${escapeHtml(monthLabel(monthKey))}">
        ${["L", "M", "X", "J", "V", "S", "D"].map(day => `<div class="calendar-month-head">${day}</div>`).join("")}
        ${weeks.map(range => renderMonthWeekRow(state, range)).join("")}
      </div>
    </article>
  `;
}

function renderMonthWeekRow(state, range) {
  const existingWeek = findWeekByStartDate(state.weeks, range.startDate);
  const isActive = existingWeek?.id === state.activeWeekId;
  const plannedCount = countPlannedSlots(existingWeek);
  const planned = hasPlannedSlots(existingWeek);
  const status = existingWeek
    ? planned
      ? `${plannedCount} huecos planificados`
      : "Creada sin platos"
    : "Sin planificar";
  const badgeClass = existingWeek ? planned ? "success" : "warning" : "";

  return `
    <section class="calendar-month-week ${isActive ? "active" : ""}">
      <div class="calendar-month-days">
        ${range.days.map(day => `<span class="calendar-month-day ${day.inMonth ? "" : "muted"}">${day.dayNumber}</span>`).join("")}
      </div>
      <div class="calendar-month-week-info">
        <strong>${escapeHtml(range.name)}</strong>
        <span class="badge ${badgeClass}">${escapeHtml(status)}</span>
      </div>
      <div class="actions wrap">
        ${existingWeek ? `<button data-action="select-calendar-week" data-week-id="${escapeHtml(existingWeek.id)}">Abrir semana</button>` : `<button class="secondary" data-action="create-calendar-week" data-start-date="${escapeHtml(range.startDate)}">Crear semana</button>`}
      </div>
    </section>
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
      <button type="button" class="secondary add-dish-button" data-action="open-dish-picker" data-slot="${escapeHtml(key)}">Añadir plato</button>
    </div>
  `;
}

function renderDishPill(state, key, dishId) {
  const dish = state.dishes.find(d => d.id === dishId);
  return `
    <span class="dish-pill">
      <button class="ghost dish-pill-name" data-action="open-dish-detail" data-dish-id="${escapeHtml(dishId)}" title="Ver ficha del plato">${escapeHtml(dish?.name || "Plato eliminado")}</button>
      <button class="ghost icon-button" aria-label="Quitar plato" data-action="remove-dish-from-slot" data-slot="${escapeHtml(key)}" data-dish-id="${escapeHtml(dishId)}">×</button>
    </span>
  `;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
