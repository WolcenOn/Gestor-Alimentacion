import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { getExpiringIngredients } from "../state/history.js";
import { DAYS, escapeHtml, formatMoney } from "../utils.js";

export function renderDashboard(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const totalSlots = DAYS.length * state.mealTypes.length * state.familyMembers.length;
  const plannedSlots = Object.values(week?.plan || {}).filter(v => v.length).length;
  const plannedPct = totalSlots ? Math.round((plannedSlots / totalSlots) * 100) : 0;
  const shopping = computeShoppingListWithProgress(state);
  const pending = shopping.filter(i => i.status === "pending" && i.remainingQty > 0).length;
  const partial = shopping.filter(i => i.status === "partial").length;
  const estimatedCost = shopping.reduce((sum, item) => {
    const ingredient = state.ingredients.find(i => i.id === item.ingredientId);
    return sum + item.remainingQty * (Number(ingredient?.approxPrice) || 0);
  }, 0);
  const expiring = getExpiringIngredients(state, 7);

  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Panel accionable</p>
        <h2>${escapeHtml(week?.name || "Sin semana activa")}</h2>
        <p class="muted">Prioriza planificación, compra, caducidades y coste.</p>
      </div>
      <button data-action="create-snapshot" class="secondary">Guardar snapshot</button>
    </div>

    <div class="grid cols-3">
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
        <h3>Coste estimado</h3>
        <p class="metric">${formatMoney(estimatedCost)}</p>
        <p class="muted">Calculado sobre cantidades restantes.</p>
      </article>
    </div>

    <div class="grid cols-2" style="margin-top:1rem">
      <article class="card">
        <h3>Caduca pronto</h3>
        ${expiring.length ? `<div class="list">${expiring.map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><span class="badge warning">${escapeHtml(i.expiryDate)}</span></div>`).join("")}</div>` : `<p class="muted">No hay ingredientes con caducidad en los próximos 7 días.</p>`}
      </article>
      <article class="card">
        <h3>Compra parcial</h3>
        ${shopping.filter(i => i.status === "partial").length ? `<div class="list">${shopping.filter(i => i.status === "partial").map(i => `<div class="item"><strong>${escapeHtml(i.name)}</strong><p class="qty-line">Comprado: ${i.display.purchased} · Falta: ${i.display.remaining}</p></div>`).join("")}</div>` : `<p class="muted">No hay compras parciales.</p>`}
      </article>
    </div>
  `;
}
