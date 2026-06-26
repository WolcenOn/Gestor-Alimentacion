import { DAYS, escapeHtml, formatQty } from "../utils.js";

export function renderPrintWeekView(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  if (!week) return `<h1>Sin semana activa</h1>`;
  return `
    <style>${printWeekStyles()}</style>
    <section class="print-week-page">
      <header class="print-week-header">
        <div>
          <p class="print-week-eyebrow">Menú semanal</p>
          <h1>${escapeHtml(week.name)}</h1>
          <p>${escapeHtml(week.startDate || "")} ${week.endDate ? `→ ${escapeHtml(week.endDate)}` : ""}</p>
        </div>
        <div class="print-week-logo">🍽️</div>
      </header>

      <table class="print-week-table">
        <thead>
          <tr>
            <th class="meal-head">Comida</th>
            ${DAYS.map(day => `<th>${escapeHtml(capitalize(day))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${state.mealTypes.map(meal => renderMealRow(state, week, meal)).join("")}
        </tbody>
      </table>

      <footer class="print-week-footer">
        <span>Generado desde Gestor de Alimentación</span>
        <span>Huecos vacíos marcados como “Sin planificar”</span>
      </footer>
    </section>
  `;
}

function renderMealRow(state, week, meal) {
  const visual = mealVisual(meal);
  return `
    <tr class="${visual.className}">
      <th class="meal-label">
        <span class="meal-print-icon">${visual.icon}</span>
        <span>${escapeHtml(meal.name)}</span>
      </th>
      ${DAYS.map(day => `<td>${renderPrintMealCell(state, week, day, meal)}</td>`).join("")}
    </tr>
  `;
}

function renderPrintMealCell(state, week, day, meal) {
  const chunks = state.familyMembers.map(member => {
    const key = `${day}__${meal.id}__${member.id}`;
    const dishIds = week.plan?.[key] || [];
    const ingredientLines = week.ingredientPlan?.[key] || [];
    const dishes = dishIds.map(id => state.dishes.find(d => d.id === id)?.name || "Plato eliminado");
    const ingredients = ingredientLines.map(line => {
      const ingredient = state.ingredients.find(item => item.id === line.ingredientId);
      return `${ingredient?.name || "Ingrediente eliminado"} · ${formatQty(line.qty, line.unit || ingredient?.unit || "g")}`;
    });
    if (!dishes.length && !ingredients.length) return "";
    return `
      <div class="print-member-block">
        <strong>${escapeHtml(member.name)}</strong>
        <ul>
          ${dishes.map(name => `<li>${escapeHtml(name)}</li>`).join("")}
          ${ingredients.map(name => `<li class="direct-ingredient">${escapeHtml(name)}</li>`).join("")}
        </ul>
      </div>`;
  }).filter(Boolean);
  return chunks.length ? chunks.join("") : `<span class="print-empty">Sin planificar</span>`;
}

function mealVisual(meal) {
  const value = `${meal.id || ""} ${meal.name || ""}`.toLowerCase();
  if (/breakfast|desayuno/.test(value)) return { icon: "☀️", className: "print-breakfast" };
  if (/lunch|comida|almuerzo/.test(value)) return { icon: "🍽️", className: "print-lunch" };
  if (/snack|merienda/.test(value)) return { icon: "🧺", className: "print-snack" };
  if (/dinner|cena/.test(value)) return { icon: "🌙", className: "print-dinner" };
  return { icon: "🍴", className: "print-other" };
}

function printWeekStyles() {
  return `
    @page { size: A4 landscape; margin: 10mm; }
    .print-week-page {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #172033;
    }
    .print-week-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      margin-bottom: 12px;
      border: 1px solid #cfe7df;
      border-radius: 18px;
      background: linear-gradient(135deg, #e6fffb, #fff7db);
    }
    .print-week-eyebrow {
      text-transform: uppercase;
      letter-spacing: .13em;
      font-size: 10px;
      font-weight: 900;
      color: #0f766e;
      margin: 0 0 4px;
    }
    .print-week-header h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
    }
    .print-week-header p {
      margin: 4px 0 0;
      color: #667085;
      font-weight: 700;
      font-size: 12px;
    }
    .print-week-logo {
      width: 48px;
      height: 48px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: #ffffff;
      border: 1px solid #d9e2ec;
      font-size: 28px;
    }
    .print-week-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid #d9e2ec;
      border-radius: 18px;
      overflow: hidden;
      background: white;
    }
    .print-week-table th,
    .print-week-table td {
      border-right: 1px solid #d9e2ec;
      border-bottom: 1px solid #d9e2ec;
      vertical-align: top;
      padding: 8px;
      font-size: 10.5px;
      line-height: 1.28;
    }
    .print-week-table thead th {
      background: #0f766e;
      color: white;
      font-size: 11px;
      text-align: center;
      font-weight: 900;
      padding: 9px 7px;
    }
    .print-week-table tr:last-child th,
    .print-week-table tr:last-child td { border-bottom: 0; }
    .print-week-table th:last-child,
    .print-week-table td:last-child { border-right: 0; }
    .meal-head { width: 96px; }
    .meal-label {
      text-align: left;
      font-size: 12px !important;
      font-weight: 950;
      color: #172033;
      background: #f8fafc;
    }
    .meal-print-icon {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      margin-right: 6px;
      border: 1px solid #d9e2ec;
      background: white;
      font-size: 15px;
    }
    .print-breakfast .meal-print-icon { background: #fff7db; border-color: #f9d47a; }
    .print-lunch .meal-print-icon { background: #e6fffb; border-color: #9ae6dd; }
    .print-snack .meal-print-icon { background: #fff1e6; border-color: #fed7aa; }
    .print-dinner .meal-print-icon { background: #eef2ff; border-color: #c7d2fe; }
    .print-member-block {
      break-inside: avoid;
      border-radius: 12px;
      border: 1px solid #e5edf5;
      background: #fbfdff;
      padding: 6px 7px;
      margin-bottom: 5px;
    }
    .print-member-block strong {
      display: block;
      color: #0b5f59;
      font-size: 10px;
      margin-bottom: 3px;
    }
    .print-member-block ul {
      margin: 0;
      padding-left: 14px;
    }
    .print-member-block li {
      margin: 1px 0;
      font-weight: 700;
    }
    .print-member-block li.direct-ingredient {
      color: #7c2d12;
    }
    .print-empty {
      display: block;
      color: #94a3b8;
      font-weight: 800;
      text-align: center;
      padding: 10px 0;
      border: 1px dashed #d9e2ec;
      border-radius: 12px;
      background: #f8fafc;
    }
    .print-week-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
      color: #667085;
      font-size: 10px;
      font-weight: 700;
    }
  `;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function printWeek(state) {
  document.body.dataset.printMode = "week";
  document.getElementById("printWeekView").innerHTML = renderPrintWeekView(state);
  window.print();
}
