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
  const plannedDishes = buildPlannedDishRows(state, week);
  const todayName = getTodayName();
  const todayDishes = plannedDishes.filter(row => row.day === todayName);
  const consumedCount = plannedDishes.filter(row => row.status === "consumed").length;
  const skippedCount = plannedDishes.filter(row => row.status === "skipped").length;
  const stockLow = state.ingredients.filter(ingredient => Number(ingredient.qty || 0) <= 0).slice(0, 5);

  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Panel accionable</p>
        <h2>${escapeHtml(week?.name || "Sin semana activa")}</h2>
        <p class="muted">Resuelve rápido el día familiar: cocinar, comprar, guardar compra y evitar desperdicio.</p>
      </div>
      <div class="header-actions compact-actions"><button data-action="open-recycling-modal" class="secondary">Registrar reciclaje</button><button data-action="create-snapshot" class="secondary">Guardar snapshot</button></div>
    </div>

    <section class="task-launcher grid cols-3">
      ${renderTaskCard("Hoy cocinamos", todayDishes.length ? `${todayDishes.length} plato(s) para ${todayName}` : `Nada planificado para ${todayName}`, "Ver semana", "calendar")}
      ${renderTaskCard("Ir a comprar", `${pending} pendientes · ${partial} parciales`, "Abrir compra", "shopping")}
      ${renderTaskCard("Planificar semana", `${plannedSlots} de ${totalSlots} huecos`, "Abrir semana", "calendar")}
      ${renderTaskCard("Guardar compra", "Escáner o entrada manual desde Compra", "Registrar", "shopping")}
      ${renderTaskCard("Aprovechar caducidades", expiring.length ? `${expiring.length} producto(s) en 7 días` : "Sin urgencias", "Ver ingredientes", "ingredients")}
      ${renderTaskCard("Revisar nutrición", `${state.nutritionProfiles.length}/${state.ingredients.length} perfiles`, "Abrir nutrición", "nutrition")}
    </section>

    <article class="card today-card" style="margin-top:1rem">
      <div class="section-title-row">
        <div>
          <h3>Hoy cocinamos</h3>
          <p class="muted">Platos de ${escapeHtml(todayName)}. Marca qué pasó realmente para mantener el stock al día.</p>
        </div>
        <span class="badge">${todayDishes.length} plato(s)</span>
      </div>
      ${todayDishes.length ? `<div class="list planned-dish-list today-dish-list">${todayDishes.map(row => renderPlannedDishRow(row, true)).join("")}</div>` : `<p class="muted">No hay platos planificados para hoy. Puedes planificarlos en Semana o usar el stock actual para improvisar.</p><div class="actions wrap"><button data-tab="calendar">Planificar hoy</button><button data-tab="ingredients" class="secondary">Ver stock</button></div>`}
    </article>

    <div class="grid cols-3" style="margin-top:1rem">
      <article class="card">
        <h3>Estado de la semana</h3>
        <p class="metric">${plannedPct}%</p>
        <p class="muted">${plannedSlots} de ${totalSlots} huecos planificados.</p>
      </article>
      <article class="card">
        <h3>Compra pendiente</h3>
        <p class="metric">${pending}</p>
        <p class="muted">${partial} ingredientes están parcialmente comprados.</p>
      </article>
      <article class="card">
        <h3>Platos revisados</h3>
        <p class="metric">${consumedCount + skippedCount}/${plannedDishes.length}</p>
        <p class="muted">Consumidos: ${consumedCount} · No consumidos: ${skippedCount}</p>
      </article>
    </div>

    <article class="card dashboard-planning-card" style="margin-top:1rem">
      <div class="section-title-row">
        <div>
          <h3>Seguimiento del menú planificado</h3>
          <p class="muted">Pulsa <strong>Consumido</strong> para descontar ingredientes. Pulsa <strong>No consumido</strong> si se comió fuera o se cambió el plato.</p>
        </div>
        <span class="badge">${plannedDishes.length} platos</span>
      </div>
      ${plannedDishes.length ? `<div class="list planned-dish-list">${plannedDishes.map(row => renderPlannedDishRow(row)).join("")}</div>` : `<p class="muted">Aún no hay platos planificados en la semana.</p>`}
    </article>

    <div class="grid cols-3" style="margin-top:1rem">
      <article class="card score-card">
        <h3>Puntuación anti-desperdicio</h3>
        <p class="metric">${wasteScore.score}/100</p>
        <p class="muted">Comprado: ${formatMoney(wasteScore.purchasedValue)} · Tirado: ${formatMoney(wasteScore.wastedValue)}</p>
      </article>
      <article class="card">
        <h3>Coste estimado</h3>
        <p class="metric">${formatMoney(estimatedCost)}</p>
        <p class="muted">Calculado sobre cantidades restantes.</p>
      </article>
      <article class="card">
        <h3>Envases para reciclar</h3>
        ${recyclingRows.length ? `<div class="recycling-bars">${recyclingRows.map(([type, qty]) => `<div><span>${escapeHtml(type)}</span><strong>${qty}</strong></div>`).join("")}</div>` : `<p class="muted">Aún no hay envases registrados.</p>`}
      </article>
      <article class="card">
        <h3>Caduca pronto</h3>
        ${expiring.length ? `<div class="list">${expiring.slice(0, 5).map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><span class="badge warning">${escapeHtml(i.expiryDate)}</span></div>`).join("")}</div>` : `<p class="muted">No hay ingredientes con caducidad en los próximos 7 días.</p>`}
      </article>
      <article class="card">
        <h3>Stock bajo</h3>
        ${stockLow.length ? `<div class="list">${stockLow.map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><p class="qty-line">${formatQty(i.qty, i.unit)}</p></div>`).join("")}</div>` : `<p class="muted">No hay ingredientes a cero.</p>`}
      </article>
      <article class="card">
        <h3>Compra parcial</h3>
        ${partialShopping.length ? `<div class="list">${partialShopping.map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><p class="qty-line">Comprado: ${i.display.purchased} · Falta: ${i.display.remaining}</p></div>`).join("")}</div>` : `<p class="muted">No hay compras parciales.</p>`}
      </article>
    </div>
  `;
}

function renderTaskCard(title, detail, buttonLabel, tab) {
  return `
    <article class="card task-card">
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(detail)}</p>
      <button type="button" data-tab="${escapeHtml(tab)}">${escapeHtml(buttonLabel)}</button>
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

function renderPlannedDishRow(row, compact = false) {
  const statusLabel = row.status === "consumed" ? "Consumido" : row.status === "skipped" ? "No consumido" : "Pendiente";
  const statusClass = row.status === "consumed" ? "" : row.status === "skipped" ? "warning" : "";
  return `
    <div class="item planned-dish-item ${escapeHtml(row.status)} ${compact ? "compact" : ""}">
      <div class="planned-dish-main">
        <div>
          <strong>${escapeHtml(row.dish.name)}</strong>
          <p class="qty-line">${escapeHtml(row.day)} · ${escapeHtml(row.meal.name)} · ${escapeHtml(row.member.name)}</p>
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="actions wrap compact-actions planned-dish-actions">
        <button type="button" data-action="mark-planned-dish-consumed" data-slot="${escapeHtml(row.slot)}" data-dish-id="${escapeHtml(row.dish.id)}" ${row.status === "consumed" ? "disabled" : ""}>Consumido</button>
        <button type="button" class="secondary" data-action="mark-planned-dish-skipped" data-slot="${escapeHtml(row.slot)}" data-dish-id="${escapeHtml(row.dish.id)}" ${row.status === "skipped" ? "disabled" : ""}>No consumido</button>
        ${row.status !== "pending" ? `<button type="button" class="ghost" data-action="reopen-planned-dish" data-slot="${escapeHtml(row.slot)}" data-dish-id="${escapeHtml(row.dish.id)}">Reabrir</button>` : ""}
      </div>
      <details>
        <summary>Ver ingredientes que se descontarán si marcas Consumido</summary>
        <ul>${row.ingredients.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
      </details>
    </div>
  `;
}
