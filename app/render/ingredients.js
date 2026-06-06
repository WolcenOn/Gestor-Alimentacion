import { escapeHtml } from "../utils.js";

export function renderIngredients(state) {
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Stock y datos externos</p>
        <h2>Ingredientes</h2>
        <p class="muted">Añade alimentos manualmente, escanea códigos o importa datos de Open Food Facts y USDA.</p>
      </div>
      <div class="header-actions compact-actions">
        <button class="secondary" data-action="open-off-search">Buscar Open Food Facts</button>
        <button class="secondary" data-action="open-usda-search">Buscar USDA</button>
      </div>
    </div>

    <div class="grid cols-2">
      <article class="card">
        <h3>Nuevo ingrediente manual</h3>
        <form data-form="ingredient">
          <div class="form-grid">
            <label>Nombre<input name="name" required placeholder="Ej. Huevos"></label>
            <label>Familia<select name="familyId">${familyOptions}</select></label>
            <label>Cantidad<input name="qty" type="number" step="0.01" min="0" required value="0"></label>
            <label>Unidad<select name="unit"><option>g</option><option>kg</option><option>ml</option><option>l</option><option>unidades</option></select></label>
            <label>Conservación<select name="storageType"><option value="pantry">Despensa</option><option value="fridge">Nevera</option><option value="freezer">Congelador</option></select></label>
            <label>Caducidad<input name="expiryDate" type="date"></label>
            <label>Tipo de fecha<select name="dateType"><option value="expiry">Caducidad</option><option value="bestBefore">Consumo preferente</option><option value="none">Sin fecha</option></select></label>
            <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="0"></label>
          </div>
          <button>Añadir ingrediente</button>
        </form>
      </article>
      <article class="card">
        <h3>Stock actual</h3>
        <div class="list ingredient-list">
          ${state.ingredients.map(i => renderIngredientItem(state, i)).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderIngredientItem(state, i) {
  const family = state.ingredientFamilies.find(f => f.id === i.familyId)?.name || "Sin familia";
  const nutrition = state.nutritionProfiles.find(n => n.ingredientId === i.id);
  return `
    <div class="item ingredient-item">
      <div class="item-title">
        <div><strong>${escapeHtml(i.name)}</strong><p class="qty-line">${Number(i.qty).toLocaleString("es-ES")} ${escapeHtml(i.unit)} · ${escapeHtml(family)}</p></div>
        ${i.expiryDate ? `<span class="badge warning">${escapeHtml(i.expiryDate)}</span>` : `<span class="badge">sin fecha</span>`}
      </div>
      <div class="mini-facts">
        <span>Productos: ${(i.products || []).length}</span>
        <span>Nutrición: ${nutrition ? "sí" : "pendiente"}</span>
      </div>
      <div class="row-actions wrap">
        <button class="secondary" data-action="edit-stock" data-ingredient-id="${escapeHtml(i.id)}">Stock</button>
        <button class="secondary" data-action="scan-ingredient-product" data-ingredient-id="${escapeHtml(i.id)}">Escanear</button>
        <button class="secondary" data-action="open-off-search" data-ingredient-id="${escapeHtml(i.id)}">OFF</button>
        <button class="secondary" data-action="open-usda-search" data-ingredient-id="${escapeHtml(i.id)}">USDA</button>
        <button class="secondary" data-action="open-waste-modal" data-ingredient-id="${escapeHtml(i.id)}">Tirar</button>
        <button class="danger" data-action="delete-ingredient" data-ingredient-id="${escapeHtml(i.id)}">Eliminar</button>
      </div>
    </div>`;
}
