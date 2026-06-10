import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { escapeHtml } from "../utils.js";

export function renderShopping(state) {
  const items = computeShoppingListWithProgress(state);
  const pendingItems = items.filter(i => ["pending", "partial"].includes(i.status) && i.remainingQty > 0);
  const doneItems = items.filter(i => i.status === "done");
  const skippedItems = items.filter(i => i.status === "skipped");
  const groups = groupShoppingItems(state, items);

  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Modo supermercado</p>
        <h2>Lista de la compra</h2>
        <p class="muted">Calculada automáticamente: recetas planificadas - stock disponible - compras ya registradas. Agrupada por zonas para comprar más rápido.</p>
      </div>
      <div class="actions">
        <button class="secondary" data-action="share-shopping">Compartir texto</button>
        <button data-action="print-shopping">Imprimir compra</button>
      </div>
    </div>

    <section class="grid cols-3 shopping-summary">
      <article class="card"><h3>Pendiente</h3><p class="metric">${pendingItems.length}</p><p class="muted">Productos por comprar o completar.</p></article>
      <article class="card"><h3>Comprado</h3><p class="metric">${doneItems.length}</p><p class="muted">Ya cubiertos para esta semana.</p></article>
      <article class="card"><h3>No comprar</h3><p class="metric">${skippedItems.length}</p><p class="muted">Omitidos solo en esta compra.</p></article>
    </section>

    <section class="card supermarket-card">
      <div class="section-title-row">
        <div>
          <h3>Recorrido de compra</h3>
          <p class="muted">Usa botones grandes: escanear, añadir manualmente o saltar esta compra.</p>
        </div>
        <span class="badge">${items.length} líneas</span>
      </div>
      <label class="quick-search-label">Buscar en la compra
        <input type="search" class="quick-search" placeholder="Ej. tomate, lácteos, pendiente, comprado..." data-search-target=".supermarket-list .supermarket-item" data-empty-target="shoppingSearchEmpty">
      </label>
      <div id="shoppingSearchEmpty" class="search-empty muted" hidden>No hay líneas de compra que coincidan.</div>
      ${items.length ? Object.values(groups).map(renderShoppingGroup).join("") : `<p class="muted">Añade platos a la semana para generar la lista de compra.</p>`}
    </section>

    ${pendingItems.length ? "" : `<p class="alert">No queda nada pendiente de compra para esta semana.</p>`}
  `;
}

function groupShoppingItems(state, items) {
  const familyMap = new Map(state.ingredientFamilies.map(family => [family.id, family.name]));
  const groups = {};
  for (const item of items) {
    const family = familyMap.get(item.familyId) || "Otros";
    const zone = supermarketZoneForFamily(family);
    groups[zone] ||= { zone, items: [] };
    groups[zone].items.push({ ...item, family, zone });
  }
  return groups;
}

function supermarketZoneForFamily(name = "") {
  const value = name.toLowerCase();
  if (/fruta|verdura|hortaliza|vegetal/.test(value)) return "Fruta y verdura";
  if (/carne|pescado|marisco|huevo|prote/i.test(value)) return "Carne, pescado y huevos";
  if (/l[aá]cteo|leche|queso|yogur/.test(value)) return "Lácteos";
  if (/congel/.test(value)) return "Congelados";
  if (/pan|cereal|arroz|pasta|legumbre|despensa|aceite|conserva/.test(value)) return "Despensa";
  return name || "Otros";
}

function renderShoppingGroup(group) {
  const active = group.items.filter(item => item.status !== "done" && item.status !== "skipped").length;
  return `
    <details class="shopping-zone" open>
      <summary><strong>${escapeHtml(group.zone)}</strong><span class="badge">${active}/${group.items.length}</span></summary>
      <div class="list supermarket-list">
        ${group.items.map(renderShoppingItem).join("")}
      </div>
    </details>
  `;
}

function renderShoppingItem(item) {
  const icon = item.status === "done" ? "✓" : item.status === "partial" ? "◐" : item.status === "skipped" ? "–" : "☐";
  const statusText = item.status === "done"
    ? "Comprado completo"
    : item.status === "partial"
      ? `Necesario: ${item.display.missing} · Comprado: ${item.display.purchased} · Falta: ${item.display.remaining}`
      : item.status === "skipped"
        ? `Omitido en esta compra · Necesario originalmente: ${item.display.missing}`
        : `Faltan: ${item.display.missing} · Tengo: ${item.display.stock}`;
  const badgeClass = item.status === "partial" || item.status === "skipped" ? "warning" : "";
  const searchText = [item.name, item.family, item.zone, item.status, statusLabel(item.status), statusText, item.display?.missing, item.display?.stock, item.display?.remaining].join(" ");
  return `
    <article class="item shopping-item supermarket-item ${escapeHtml(item.status)}" data-search="${escapeHtml(searchText)}">
      <div>
        <div class="item-title"><strong>${icon} ${escapeHtml(item.name)}</strong><span class="badge ${badgeClass}">${escapeHtml(statusLabel(item.status))}</span></div>
        <p class="qty-line">${statusText}</p>
      </div>
      <div class="row-actions no-print supermarket-actions">
        ${item.status !== "done" && item.status !== "skipped" ? `
          <button data-action="scan-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Escanear</button>
          <button class="secondary" data-action="manual-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Añadir manual</button>
          <button class="ghost" data-action="skip-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">No comprar</button>` : ""}
        ${item.status === "done" ? `<button class="secondary" data-action="manual-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Añadir más</button>` : ""}
        ${item.status === "skipped" ? `<button class="secondary" data-action="reopen-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Reactivar</button>` : ""}
      </div>
    </article>`;
}

function statusLabel(status) {
  if (status === "done") return "comprado";
  if (status === "partial") return "parcial";
  if (status === "skipped") return "no comprar";
  return "pendiente";
}
