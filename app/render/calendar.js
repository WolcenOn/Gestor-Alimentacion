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

    <section class="card calendar-week-legend" aria-label="Leyenda de planificación">
      <strong>Estado de la semana</strong>
      <div class="meal-legend-list">
        <span class="plan-status-chip plan-status-complete">Planificado todo</span>
        <span class="plan-status-chip plan-status-partial">Faltan platos</span>
        <span class="plan-status-chip plan-status-empty">Sin planificar</span>
      </div>
    </section>

    <div class="week-mobile-grid accessible-week-grid">
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
  const status = dayPlanningStatus(state, week, day);
  return `
    <details class="day-card accessible-day-card planning-day-card ${status.className}">
      <summary class="day-card-header accessible-day-header planning-day-summary">
        <div>
          <h3>${escapeHtml(capitalize(day))}</h3>
          <p class="qty-line">${escapeHtml(status.helpText)}</p>
        </div>
        <span class="plan-status-chip ${status.className}">${escapeHtml(status.label)}</span>
      </summary>
      <div class="day-meals accessible-day-meals">
        ${state.mealTypes.map(meal => renderMealBlock(state, week, day, meal)).join("")}
      </div>
    </details>
  `;
}

function renderMealBlock(state, week, day, meal) {
  const visual = mealVisual(meal);
  const summary = mealSummary(state, week, day, meal);
  return `
    <details class="meal-block accessible-meal-block ${visual.className}">
      <summary class="meal-block-summary">
        <span class="meal-title-row">
          <span class="meal-icon" aria-hidden="true">${visual.icon}</span>
          <span>
            <strong>${escapeHtml(meal.name)}</strong>
            <small>${summary.memberCount ? `${summary.memberCount} miembro(s) con plato` : "Sin asignar"}</small>
          </span>
        </span>
        <span class="badge ${summary.dishCount ? "success" : "warning"}">${summary.dishCount} plato(s)</span>
      </summary>
      <div class="member-slots compact-member-slots">
        ${state.familyMembers.map(member => renderMemberSlot(state, week, day, meal, member)).join("")}
      </div>
    </details>
  `;
}

function renderMemberSlot(state, week, day, meal, member) {
  const key = `${day}__${meal.id}__${member.id}`;
  const planned = week.plan[key] || [];
  const statusClass = planned.length ? "has-dishes" : "is-empty";
  return `
    <div class="member-slot compact-member-slot ${statusClass}">
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

function mealSummary(state, week, day, meal) {
  let dishCount = 0;
  let memberCount = 0;
  for (const member of state.familyMembers) {
    const key = `${day}__${meal.id}__${member.id}`;
    const planned = week.plan[key] || [];
    if (planned.length) {
      memberCount += 1;
      dishCount += planned.length;
    }
  }
  return { dishCount, memberCount };
}

function dayPlanningStatus(state, week, day) {
  const expected = expectedDaySlots(state);
  const planned = countDayPlannedSlots(state, week, day);
  const missing = Math.max(expected - planned, 0);
  if (!planned) return { className: "plan-status-empty", label: "Sin planificar", helpText: `Faltan ${expected} plato(s)` };
  if (!missing) return { className: "plan-status-complete", label: "Planificado todo", helpText: `${planned}/${expected} plato(s) asignado(s)` };
  return { className: "plan-status-partial", label: `Faltan ${missing} plato(s)`, helpText: `${planned}/${expected} plato(s) asignado(s)` };
}

function expectedDaySlots(state) {
  return Math.max((state.mealTypes?.length || 0) * (state.familyMembers?.length || 0), 1);
}

function countDayPlannedSlots(state, week, day) {
  let total = 0;
  for (const meal of state.mealTypes) {
    for (const member of state.familyMembers) {
      const key = `${day}__${meal.id}__${member.id}`;
      if ((week.plan[key] || []).length) total += 1;
    }
  }
  return total;
}

function mealVisual(meal) {
  const value = `${meal.id || ""} ${meal.name || ""}`.toLowerCase();
  if (/breakfast|desayuno/.test(value)) return { icon: "☀️", className: "meal-breakfast" };
  if (/lunch|comida|almuerzo/.test(value)) return { icon: "🍽️", className: "meal-lunch" };
  if (/snack|merienda/.test(value)) return { icon: "🧺", className: "meal-snack" };
  if (/dinner|cena/.test(value)) return { icon: "🌙", className: "meal-dinner" };
  return { icon: "🍴", className: "meal-other" };
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
