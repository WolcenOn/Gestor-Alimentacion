import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { getExpiringIngredients } from "../state/history.js";
import { DAYS, escapeHtml, formatMoney, formatQty } from "../utils.js";
import { getWasteScore, getRecyclingSummary } from "../state/wasteRecycling.js";
import { getPlannedDishStatus } from "../state/stock.js";

export function renderDashboard(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const totalSlots = DAYS.length * state.mealTypes.length * state.familyMembers.length;
  const plannedSlots = Object.values(week?.plan || {}).filter(v => v.length).length;
  const plannedPct = totalSlots ? Math.round((plannedSlots / totalSlots) * 100) : 0;
  const shopping = computeShoppingListWithProgress(state);
  const pendingShopping = shopping.filter(i => i.status === "pending" && i.remainingQty > 0);
  const partialShopping = shopping.filter(i => i.status === "partial");
  const pending = pendingShopping.length;
  const partial = partialShopping.length;
  const estimatedCost = shopping.reduce((sum, item) => {
    const ingredient = state.ingredients.find(i => i.id === item.ingredientId);
    return sum + item.remainingQty * (Number(ingredient?.approxPrice) || 0);
  }, 0);
  const expiring = getExpiringIngredients(state, 7);
  const wasteScore = getWasteScore(state);
  const recycling = getRecyclingSummary(state);
  const recyclingRows = Object.entries(recycling);
  const totalRecycling = recyclingRows.reduce((sum, [, qty]) => sum + Number(qty || 0), 0);
  const plannedDishes = buildPlannedDishRows(state, week);
  const todayName = getTodayName();
  const todayDishes = plannedDishes.filter(row => row.day === todayName);
  const consumedCount = plannedDishes.filter(row => row.status === "consumed").length;
  const skippedCount = plannedDishes.filter(row => row.status === "skipped").length;
  const pendingReviewCount = plannedDishes.filter(row => row.status === "pending").length;
  const stockLow = state.ingredients.filter(ingredient => Number(ingredient.qty || 0) <= 0).slice(0, 5);

  return `
    <div class="card-header dashboard-header-clean">
      <div>
        <p class="eyebrow">Panel accionable</p>
        <h2>${escapeHtml(week?.name || "Sin semana activa")}</h2>
        <p class="muted">Accede rápido a lo que importa: cocinar, revisar días pendientes, comprar y completar la semana.</p>
      </div>
    </div>

    <section class="dashboard-card-grid task-launcher">
      ${renderTaskCard("Hoy cocinamos", todayDishes.length ? `${todayDishes.length} plato(s) para ${todayName}` : `Nada planificado para ${todayName}`, "Abrir cocina", { action: "open-cooking-review", day: todayName })}
      ${renderTaskCard("Ir a comprar", `${pending} pendientes · ${partial} parciales`, "Abrir compra", { tab: "shopping" })}
      ${renderTaskCard("Planificar semana", `${plannedSlots} de ${totalSlots} huecos`, "Abrir semana", { tab: "calendar" })}
      ${renderTaskCard("Asistente semanal", "Rellena días, comidas y miembros con recetas en rotación", "Automatizar", { action: "open-week-planner-assistant" })}
      ${renderTaskCard("Guardar compra", "Escáner o entrada manual desde Compra", "Registrar", { tab: "shopping" })}
      ${renderTaskCard("Aprovechar caducidades", expiring.length ? `${expiring.length} producto(s) en 7 días` : "Sin urgencias", "Ver ingredientes", { tab: "ingredients" })}
      ${renderTaskCard("Registrar reciclaje", totalRecycling ? `${totalRecycling} envase(s) registrados` : "Añade envases al cerrar compra", "Registrar", { action: "open-recycling-modal" })}
      ${renderTaskCard("Revisar nutrición", `${state.nutritionProfiles.length}/${state.ingredients.length} perfiles`, "Abrir nutrición", { tab: "nutrition" })}
    </section>

    <div class="dashboard-card-grid dashboard-metric-grid">
      <article class="card compact-dashboard-card">
        <h3>Estado semana</h3>
        <p class="metric">${plannedPct}%</p>
        <p class="muted">${plannedSlots} de ${totalSlots} huecos.</p>
        <button type="button" class="secondary" data-tab="calendar">Completar semana</button>
      </article>
      <article class="card compact-dashboard-card">
        <h3>Compra pendiente</h3>
        <p class="metric">${pending}</p>
        <p class="muted">${partial} parcialmente comprados.</p>
        <button type="button" class="secondary" data-tab="shopping">Abrir compra</button>
      </article>
      <article class="card compact-dashboard-card dashboard-review-summary">
        <h3>Revisión de platos</h3>
        <p class="metric">${consumedCount + skippedCount}/${plannedDishes.length}</p>
        <p class="muted">Pendientes: ${pendingReviewCount}</p>
        <div class="dashboard-status-row">
          <span class="badge success">${consumedCount} consumidos</span>
          <span class="badge warning">${skippedCount} no consumidos</span>
        </div>
        <button type="button" class="secondary" data-action="open-cooking-review" data-day="${escapeHtml(todayName)}">Revisar días</button>
      </article>
      <article class="card compact-dashboard-card score-card">
        <h3>Anti-desperdicio</h3>
        <p class="metric">${wasteScore.score}/100</p>
        <p class="muted">Tirado: ${formatMoney(wasteScore.wastedValue)}</p>
      </article>
      <article class="card compact-dashboard-card">
        <h3>Coste estimado</h3>
        <p class="metric">${formatMoney(estimatedCost)}</p>
        <p class="muted">Cantidades restantes.</p>
      </article>
      <article class="card compact-dashboard-card">
        <h3>Envases</h3>
        ${recyclingRows.length ? `<div class="recycling-bars compact-recycling-bars">${recyclingRows.map(([type, qty]) => `<div><span>${escapeHtml(type)}</span><strong>${qty}</strong></div>`).join("")}</div>` : `<p class="muted">Sin envases registrados.</p>`}
      </article>
      <article class="card compact-dashboard-card dashboard-list-card">
        <h3>Caduca pronto</h3>
        ${expiring.length ? `<div class="list compact-list">${expiring.slice(0, 3).map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><span class="badge warning">${escapeHtml(i.expiryDate)}</span></div>`).join("")}</div>` : `<p class="muted">Sin urgencias.</p>`}
      </article>
      <article class="card compact-dashboard-card dashboard-list-card">
        <h3>Stock bajo</h3>
        ${stockLow.length ? `<div class="list compact-list">${stockLow.slice(0, 3).map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><p class="qty-line">${formatQty(i.qty, i.unit)}</p></div>`).join("")}</div>` : `<p class="muted">Nada a cero.</p>`}
      </article>
      <article class="card compact-dashboard-card dashboard-list-card">
        <h3>Compra parcial</h3>
        ${partialShopping.length ? `<div class="list compact-list">${partialShopping.slice(0, 3).map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><p class="qty-line">Falta: ${i.display.remaining}</p></div>`).join("")}</div>` : `<p class="muted">Sin parciales.</p>`}
      </article>
    </div>
  `;
}

export function renderCookingReviewModal(state, selectedDay = getTodayName()) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const plannedDishes = buildPlannedDishRows(state, week);
  const safeDay = DAYS.includes(selectedDay) ? selectedDay : getTodayName();
  const dayDishes = plannedDishes.filter(row => row.day === safeDay);
  return `
    <div class="dashboard-cooking-modal" data-cooking-review-day="${escapeHtml(safeDay)}">
      <header>
        <div>
          <p class="eyebrow">Cocina y revisión</p>
          <h2>Ficha de cocina · ${escapeHtml(capitalize(safeDay))}</h2>
          <p class="muted">Cambia de día para marcar platos atrasados como consumidos o no consumidos.</p>
        </div>
        <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
      </header>
      <nav class="dashboard-day-switcher" aria-label="Elegir día para revisar">
        ${DAYS.map(day => `<button type="button" class="${day === safeDay ? "" : "secondary"}" data-action="open-cooking-review" data-day="${escapeHtml(day)}">${escapeHtml(capitalize(day.slice(0, 3)))}</button>`).join("")}
      </nav>
      ${dayDishes.length ? renderTodayMealGroups(state, dayDishes) : renderEmptyDayCard(safeDay)}
    </div>
  `;
}

function renderTaskCard(title, detail, buttonLabel, target = {}) {
  const attrs = target.action
    ? `data-action="${escapeHtml(target.action)}" ${target.day ? `data-day="${escapeHtml(target.day)}"` : ""}`
    : `data-tab="${escapeHtml(target.tab)}"`;
  return `
    <article class="card task-card compact-dashboard-card">
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(detail)}</p>
      <button type="button" ${attrs}>${escapeHtml(buttonLabel)}</button>
    </article>
  `;
}

function renderEmptyDayCard(day) {
  return `
    <div class="empty-dashboard-state">
      <strong>No hay platos planificados para ${escapeHtml(day)}.</strong>
      <p class="muted">Puedes planificar este día desde Semana o revisar otro día de la semana.</p>
      <div class="actions wrap">
        <button type="button" data-tab="calendar">Planificar día</button>
      </div>
    </div>
  `;
}

function renderTodayMealGroups(state, todayDishes) {
  const grouped = new Map();
  for (const row of todayDishes) {
    const mealId = row.meal.id || row.meal.name;
    if (!grouped.has(mealId)) grouped.set(mealId, { meal: row.meal, rows: [] });
    grouped.get(mealId).rows.push(row);
  }
  return `
    <div class="today-meal-grid">
      ${[...grouped.values()].map(group => renderTodayMealGroup(state, group.meal, group.rows)).join("")}
    </div>
  `;
}

function renderTodayMealGroup(state, meal, rows) {
  const visual = mealVisual(meal);
  return `
    <section class="today-meal-card ${visual.className}">
      <header class="today-meal-header">
        <span class="meal-icon" aria-hidden="true">${visual.icon}</span>
        <div>
          <h4>${escapeHtml(meal.name)}</h4>
          <p class="qty-line">${rows.length} plato(s) para revisar</p>
        </div>
      </header>
      <div class="today-dish-card-list">
        ${rows.map(row => renderTodayDishCard(row)).join("")}
      </div>
    </section>
  `;
}

function renderTodayDishCard(row) {
  const statusLabel = row.status === "consumed" ? "Consumido" : row.status === "skipped" ? "No consumido" : "Pendiente";
  const statusClass = row.status === "consumed" ? "success" : row.status === "skipped" ? "warning" : "";
  return `
    <article class="today-dish-card ${escapeHtml(row.status)}">
      <div class="today-dish-main">
        <button class="ghost dish-pill-name" data-action="open-dish-detail" data-dish-id="${escapeHtml(row.dish.id)}" title="Ver ficha del plato">${escapeHtml(row.dish.name)}</button>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <p class="qty-line">${escapeHtml(row.member.name)}</p>
      <div class="actions wrap compact-actions planned-dish-actions">
        <button type="button" data-action="mark-planned-dish-consumed" data-slot="${escapeHtml(row.slot)}" data-dish-id="${escapeHtml(row.dish.id)}" ${row.status === "consumed" ? "disabled" : ""}>Consumido</button>
        <button type="button" class="secondary" data-action="mark-planned-dish-skipped" data-slot="${escapeHtml(row.slot)}" data-dish-id="${escapeHtml(row.dish.id)}" ${row.status === "skipped" ? "disabled" : ""}>No consumido</button>
        ${row.status !== "pending" ? `<button type="button" class="ghost" data-action="reopen-planned-dish" data-slot="${escapeHtml(row.slot)}" data-dish-id="${escapeHtml(row.dish.id)}">Reabrir</button>` : ""}
      </div>
      <details>
        <summary>Ingredientes a descontar</summary>
        <ul>${row.ingredients.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
      </details>
    </article>
  `;
}

function getTodayName() {
  const jsDay = new Date().getDay();
  const map = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return map[jsDay];
}

function buildPlannedDishRows(state, week) {
  if (!week) return [];
  const rows = [];
  for (const day of DAYS) {
    for (const meal of state.mealTypes) {
      for (const member of state.familyMembers) {
        const slot = `${day}__${meal.id}__${member.id}`;
        for (const dishId of week.plan?.[slot] || []) {
          const dish = state.dishes.find(item => item.id === dishId);
          if (!dish) continue;
          rows.push({
            day,
            meal,
            member,
            slot,
            dish,
            status: getPlannedDishStatus(state, slot, dishId, week.id),
            ingredients: (dish.recipe || []).map(line => {
              const ingredient = state.ingredients.find(item => item.id === line.ingredientId);
              return `${ingredient?.name || "Ingrediente eliminado"}: ${formatQty(line.qty, line.unit)}`;
            })
          });
        }
      }
    }
  }
  return rows;
}

function mealVisual(meal) {
  const value = `${meal.id || ""} ${meal.name || ""}`.toLowerCase();
  if (/breakfast|desayuno/.test(value)) return { icon: "☀️", className: "meal-breakfast" };
  if (/lunch|comida|almuerzo/.test(value)) return { icon: "🍽️", className: "meal-lunch" };
  if (/snack|merienda/.test(value)) return { icon: "🧺", className: "meal-snack" };
  if (/dinner|cena/.test(value)) return { icon: "🌙", className: "meal-dinner" };
  return { icon: "🍴", className: "meal-other" };
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
