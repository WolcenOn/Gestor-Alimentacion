import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { escapeHtml } from "../utils.js";

export function renderShopping(state) {
  const items = computeShoppingListWithProgress(state);
  const pendingItems = items.filter(i => i.remainingQty > 0);
  return `
    <div class="card-header">
      <div>
        <h2>Lista de la compra</h2>
        <p class="muted">Calculada automáticamente: recetas planificadas - stock disponible - compras ya registradas.</p>
      </div>
      <div class="actions">
        <button class="secondary" data-action="share-shopping">Compartir texto</button>
        <button data-action="print-shopping">Imprimir compra</button>
      </div>
    </div>
    <section class="card">
      ${items.length ? `<div class="list">${items.map(renderShoppingItem).join("")}</div>` : `<p class="muted">Añade platos a la semana para generar la lista de compra.</p>`}
    </section>
    ${pendingItems.length ? "" : `<p class="alert">No queda nada pendiente de compra para esta semana.</p>`}
  `;
}

function renderShoppingItem(item) {
  const icon = item.status === "done" ? "✓" : item.status === "partial" ? "◐" : "☐";
  const statusText = item.status === "done" ? "Comprado completo" : item.status === "partial" ? `Necesario: ${item.display.missing} · Comprado: ${item.display.purchased} · Falta: ${item.display.remaining}` : `Faltan: ${item.display.missing} · Tengo: ${item.display.stock}`;
  return `
    <article class="item shopping-item ${escapeHtml(item.status)}">
      <div>
        <div class="item-title"><strong>${icon} ${escapeHtml(item.name)}</strong><span class="badge ${item.status === "partial" ? "warning" : ""}">${escapeHtml(item.status)}</span></div>
        <p class="qty-line">${statusText}</p>
      </div>
      <div class="row-actions no-print">
        ${item.status !== "done" ? `
          <button data-action="scan-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Escanear</button>
          <button class="secondary" data-action="manual-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Añadir manual</button>` : `<button class="secondary" data-action="manual-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Añadir más</button>`}
      </div>
    </article>`;
}
