import { escapeHtml } from "../utils.js";

export function renderIngredients(state) {
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
  return `
    <div class="grid cols-2">
      <article class="card">
        <h2>Ingredientes</h2>
        <p class="muted">Stock lógico, no marcas concretas. Los códigos de barras se asocian como productos.</p>
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
        <h2>Stock actual</h2>
        <div class="list">
          ${state.ingredients.map(i => renderIngredientItem(state, i)).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderIngredientItem(state, i) {
  const family = state.ingredientFamilies.find(f => f.id === i.familyId)?.name || "Sin familia";
  return `
    <div class="item">
      <div class="item-title">
        <div><strong>${escapeHtml(i.name)}</strong><p class="qty-line">${Number(i.qty).toLocaleString("es-ES")} ${escapeHtml(i.unit)} · ${escapeHtml(family)}</p></div>
        ${i.expiryDate ? `<span class="badge warning">${escapeHtml(i.expiryDate)}</span>` : `<span class="badge">sin fecha</span>`}
      </div>
      <p class="small muted">Productos asociados: ${(i.products || []).length}</p>
      <div class="row-actions">
        <button class="secondary" data-action="edit-stock" data-ingredient-id="${escapeHtml(i.id)}">Ajustar stock</button>
        <button class="danger" data-action="delete-ingredient" data-ingredient-id="${escapeHtml(i.id)}">Eliminar</button>
      </div>
    </div>`;
}
