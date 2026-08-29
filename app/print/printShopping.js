import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { directPurchasesForWeek } from "../state/directPurchases.js";
import { escapeHtml, formatMoney, formatQty } from "../utils.js";

export function renderPrintShoppingView(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const items = computeShoppingListWithProgress(state).filter(item => item.remainingQty > 0);
  const directItems = directPurchasesForWeek(state);
  return `
    <h1>Lista de la compra · ${escapeHtml(week?.name || "Semana")}</h1>
    <h2>Alimentos</h2>
    <table>
      <thead><tr><th>Ingrediente</th><th>Cantidad</th></tr></thead>
      <tbody>
        ${items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${formatQty(item.remainingQty, item.unit)}</td></tr>`).join("")}
      </tbody>
    </table>
    <h2>Otros productos</h2>
    ${directItems.length ? `
      <table>
        <thead><tr><th>Producto</th><th>Unidades</th><th>Importe</th></tr></thead>
        <tbody>
          ${directItems.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${Number(item.quantity) || 0}</td><td>${formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0))}</td></tr>`).join("")}
        </tbody>
      </table>` : `<p>Sin otros productos.</p>`}
  `;
}

export function printShopping(state) {
  document.body.dataset.printMode = "shopping";
  document.getElementById("printShoppingView").innerHTML = renderPrintShoppingView(state);
  window.print();
}
