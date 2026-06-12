import { computeShoppingListWithProgress } from "../state/shoppingProgress.js";
import { escapeHtml } from "../utils.js";
import { isTrustedPurchaseEnabled } from "../fastPurchase.js";
import { renderIngredientCard } from "./ingredientCard.js";

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
      ${items.length ? Object.values(groups).map(group => renderShoppingGroup(state, group)).join("") : `<p class="muted">Añade platos a la semana para generar la lista de compra.</p>`}
    </section>

    ${pendingItems.length ? "" : `<p class="alert">No queda nada pendiente de compra para esta semana.</p>`}
  `;
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
    <details class="shopping-zone" open>
      <summary><strong>${escapeHtml(group.zone)}</strong><span class="badge">${active}/${group.items.length}</span></summary>
      <div class="list supermarket-list">
        ${group.items.map(item => renderIngredientCard(state, item.ingredient || {}, { mode: "shop", shoppingItem: item })).join("")}
      </div>
    </details>
  `;
}
