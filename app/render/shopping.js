import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { escapeHtml } from "../utils.js";
import { isTrustedPurchaseEnabled } from "../fastPurchase.js";
import { renderIngredientCard } from "./ingredientCard.js";

const SHOPPING_FILTER_KEY = "gestorMenuSemanal.shoppingStatusFilter.v1";
const FILTERS = [
  { id: "open", label: "Por comprar", statuses: ["pending", "partial"] },
  { id: "pending", label: "Pendientes", statuses: ["pending"] },
  { id: "partial", label: "Parciales", statuses: ["partial"] },
  { id: "done", label: "Comprados", statuses: ["done"] },
  { id: "skipped", label: "No comprar", statuses: ["skipped"] },
  { id: "all", label: "Todo", statuses: ["pending", "partial", "done", "skipped"] }
];

export function renderShopping(state) {
  const items = computeShoppingListWithProgress(state);
  const activeFilter = getActiveShoppingFilter();
  const filteredItems = filterShoppingItems(items, activeFilter);
  const openItems = items.filter(i => ["pending", "partial"].includes(i.status) && i.remainingQty > 0);
  const groups = groupShoppingItems(state, filteredItems);
  const activeFilterLabel = FILTERS.find(filter => filter.id === activeFilter)?.label || "Por comprar";

  return `
    <div class="card-header compact-section-header">
      <div>
        <h2>Compra</h2>
      </div>
      <div class="actions">
        <button type="button" class="secondary info-button" data-action="open-shopping-help" aria-label="Ayuda sobre la lista de compra">?</button>
        <button class="secondary" data-action="share-shopping">Compartir</button>
        <button data-action="print-shopping">Imprimir</button>
      </div>
    </div>

    <section class="card supermarket-card compact-supermarket-card" data-shopping-filter-root data-active-shopping-filter="${escapeHtml(activeFilter)}">
      <div class="section-title-row compact-section-title-row">
        <div>
          <h3>${escapeHtml(activeFilterLabel)}</h3>
        </div>
        <span class="badge">${filteredItems.length}/${items.length}</span>
      </div>
      <div class="shopping-filter-bar no-print" role="group" aria-label="Filtrar lista de compra por estado">
        ${FILTERS.map(filter => renderFilterButton(filter, activeFilter, items)).join("")}
      </div>
      <label class="quick-search-label compact-search-label">Buscar
        <input type="search" class="quick-search" placeholder="Tomate, lácteos, comprado..." data-search-target=".supermarket-list .supermarket-item" data-empty-target="shoppingSearchEmpty">
      </label>
      <div id="shoppingSearchEmpty" class="search-empty muted" hidden>No hay líneas de compra que coincidan.</div>
      ${filteredItems.length ? Object.values(groups).map(group => renderShoppingGroup(state, group)).join("") : renderEmptyFilterState(activeFilter, items.length)}
    </section>

    ${openItems.length ? "" : `<p class="alert">No queda nada pendiente de compra para esta semana.</p>`}
  `;
}

function getActiveShoppingFilter() {
  try {
    const saved = localStorage.getItem(SHOPPING_FILTER_KEY) || "open";
    return FILTERS.some(filter => filter.id === saved) ? saved : "open";
  } catch {
    return "open";
  }
}

function filterShoppingItems(items, filterId) {
  const filter = FILTERS.find(item => item.id === filterId) || FILTERS[0];
  return items.filter(item => filter.statuses.includes(item.status));
}

function countForFilter(items, filter) {
  return items.filter(item => filter.statuses.includes(item.status)).length;
}

function renderFilterButton(filter, activeFilter, items) {
  const active = filter.id === activeFilter;
  const count = countForFilter(items, filter);
  return `
    <button type="button" class="${active ? "" : "secondary"}" data-action="set-shopping-filter" data-shopping-filter="${escapeHtml(filter.id)}" aria-pressed="${active ? "true" : "false"}">
      ${escapeHtml(filter.label)} <span class="mini-badge">${count}</span>
    </button>
  `;
}

function renderEmptyFilterState(filterId, totalItems) {
  if (!totalItems) return `<p class="muted">Añade platos a la semana para generar la lista de compra.</p>`;
  const label = FILTERS.find(filter => filter.id === filterId)?.label || "este filtro";
  return `<p class="muted">No hay productos en “${escapeHtml(label)}”. Cambia de filtro para ver otras líneas de compra.</p>`;
}

function groupShoppingItems(state, items) {
  const familyMap = new Map(state.ingredientFamilies.map(family => [family.id, family.name]));
  const ingredientMap = new Map(state.ingredients.map(ingredient => [ingredient.id, ingredient]));
  const groups = {};
  for (const item of items) {
    const family = familyMap.get(item.familyId) || "Otros";
    const zone = supermarketZoneForFamily(family);
    const ingredient = ingredientMap.get(item.ingredientId);
    const fastPurchase = isTrustedPurchaseEnabled(ingredient);
    groups[zone] ||= { zone, items: [] };
    groups[zone].items.push({ ...item, ingredient, family, zone, fastPurchase });
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

function renderShoppingGroup(state, group) {
  const active = group.items.filter(item => item.status !== "done" && item.status !== "skipped").length;
  return `
    <details class="shopping-zone compact-shopping-zone" open>
      <summary><strong>${escapeHtml(group.zone)}</strong><span class="badge">${active}/${group.items.length}</span></summary>
      <div class="list supermarket-list compact-supermarket-list">
        ${group.items.map(item => renderIngredientCard(state, item.ingredient || {}, { mode: "shop", shoppingItem: item })).join("")}
      </div>
    </details>
  `;
}
