import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { escapeHtml, formatQty } from "../utils.js";

export function renderPrintShoppingView(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const items = computeShoppingListWithProgress(state).filter(item => item.remainingQty > 0);
  return `
    <h1>Lista de la compra · ${escapeHtml(week?.name || "Semana")}</h1>
    <table>
      <thead><tr><th>Ingrediente</th><th>Cantidad</th></tr></thead>
      <tbody>
        ${items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${formatQty(item.remainingQty, item.unit)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

export function printShopping(state) {
  document.body.dataset.printMode = "shopping";
  document.getElementById("printShoppingView").innerHTML = renderPrintShoppingView(state);
  window.print();
}
