import { escapeHtml } from "../utils.js";

const PACKAGING_OPTIONS = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];

export function renderIngredients(state) {
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
  const packagingOptions = PACKAGING_OPTIONS.map(type => `<option>${escapeHtml(type)}</option>`).join("");
  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Alta de alimentos y stock</p>
        <h2>Ingredientes</h2>
        <p class="muted">Consulta el stock rápidamente o despliega el formulario solo cuando quieras añadir alimentos.</p>
      </div>
      <div class="header-actions compact-actions">
        <button class="secondary" data-action="scan-new-ingredient">Escanear nuevo alimento</button>
        <button class="secondary" data-action="open-off-search">Buscar Open Food Facts</button>
        <button class="secondary" data-action="open-usda-search">Buscar USDA</button>
      </div>
    </div>

    <div class="stacked-layout">
      <details class="card collapsible-card">
        <summary class="collapsible-summary">
          <span>
            <strong>Nuevo ingrediente</strong>
            <small>Escaneo, Open Food Facts, USDA o alta manual</small>
          </span>
          <span class="summary-hint">Desplegar</span>
        </summary>
        <div class="collapsible-body">
          <p class="muted">El escaneo y las búsquedas rellenan nombre, producto, nutrición y envase cuando la base de datos lo ofrece.</p>
          <div class="quick-actions ingredients-import-actions">
            <button type="button" data-action="scan-new-ingredient">Escanear código</button>
            <button type="button" class="secondary" data-action="open-off-search">Buscar en Open Food Facts</button>
            <button type="button" class="secondary" data-action="open-usda-search">Buscar en USDA</button>
          </div>
          <form data-form="ingredient">
            <div class="form-grid">
              <label>Nombre<input name="name" required placeholder="Ej. Huevos"></label>
              <label>Familia<select name="familyId">${familyOptions}</select></label>
              <label>Cantidad inicial<input name="qty" type="number" step="0.01" min="0" required value="0"></label>
              <label>Unidad<select name="unit"><option>g</option><option>kg</option><option>ml</option><option>l</option><option>unidades</option></select></label>
              <label>Conservación<select name="storageType"><option value="pantry">Despensa</option><option value="fridge">Nevera</option><option value="freezer">Congelador</option></select></label>
              <label>Caducidad<input name="expiryDate" type="date"></label>
              <label>Tipo de fecha<select name="dateType"><option value="expiry">Caducidad</option><option value="bestBefore">Consumo preferente</option><option value="none">Sin fecha</option></select></label>
              <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="0"></label>
              <label>Tipo de envase<select name="packagingType">${packagingOptions}</select></label>
              <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" placeholder="opcional"></label>
              <label>Marca<input name="brand" placeholder="opcional"></label>
              <label>Nombre del producto<input name="productName" placeholder="opcional"></label>
            </div>
            <button>Añadir ingrediente</button>
          </form>
        </div>
      </details>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Stock actual</h3>
            <p class="muted">Busca por nombre, familia, envase, cantidad, producto asociado o estado nutricional.</p>
          </div>
          <span class="badge">${state.ingredients.length} ingredientes</span>
        </div>
        <label class="quick-search-label">Búsqueda rápida de ingredientes
          <input type="search" class="quick-search" placeholder="Ej. tomate, nevera, vidrio, sin fecha..." data-search-target=".ingredient-list .ingredient-item" data-empty-target="ingredientSearchEmpty">
        </label>
        <div id="ingredientSearchEmpty" class="search-empty muted" hidden>No hay ingredientes que coincidan con la búsqueda.</div>
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
  const productCount = (i.products || []).length;
  const productText = (i.products || []).map(p => [p.productName, p.brand, p.barcode, p.packagingType, p.packaging].filter(Boolean).join(" ")).join(" ");
  const packaging = i.packagingType || i.products?.find(p => p.packagingType || p.packaging)?.packagingType || i.products?.find(p => p.packaging)?.packaging || "sin envase";
  const searchText = [i.name, family, i.qty, i.unit, i.expiryDate || "sin fecha", i.storageType, packaging, nutrition ? "nutrición sí" : "nutrición pendiente", productText].join(" ");
  return `
    <div class="item ingredient-item" data-search="${escapeHtml(searchText)}">
      <div class="item-title">
        <div><strong>${escapeHtml(i.name)}</strong><p class="qty-line">${Number(i.qty).toLocaleString("es-ES")} ${escapeHtml(i.unit)} · ${escapeHtml(family)}</p></div>
        ${i.expiryDate ? `<span class="badge warning">${escapeHtml(i.expiryDate)}</span>` : `<span class="badge">sin fecha</span>`}
      </div>
      <div class="mini-facts">
        <span>Productos asociados: ${productCount}</span>
        <span>Nutrición: ${nutrition ? "sí" : "pendiente"}</span>
        <span>Envase: ${escapeHtml(packaging)}</span>
      </div>
      <div class="row-actions wrap">
        <button class="secondary" data-action="edit-stock" data-ingredient-id="${escapeHtml(i.id)}">Editar stock</button>
        <button class="secondary" data-action="open-waste-modal" data-ingredient-id="${escapeHtml(i.id)}">Tirar</button>
        <button class="danger" data-action="delete-ingredient" data-ingredient-id="${escapeHtml(i.id)}">Eliminar</button>
      </div>
    </div>`;
}
