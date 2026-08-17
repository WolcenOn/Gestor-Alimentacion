import { escapeHtml } from "../utils.js";

const UNIT_OPTIONS = ["g", "kg", "ml", "l", "unidades"];
const INITIAL_RECIPE_LINE_ID = "recipe_line_1";

export function renderDishes(state) {
  return `
    <div class="stacked-layout">
      <details class="card collapsible-card">
        <summary class="collapsible-summary">
          <span>
            <strong>Nuevo plato o receta</strong>
            <small>Formulario plegado para consultar el recetario más rápido</small>
          </span>
          <span class="summary-hint">Desplegar</span>
        </summary>
        <div class="collapsible-body">
          <h2>Platos y recetas</h2>
          <p class="muted">Añade recetas normalizadas. Para facilitar la nutrición por miembro, se recomienda introducir cantidades por 1 ración.</p>
          <form data-form="dish">
            <div class="form-grid">
              <label>Nombre<input name="name" required placeholder="Ej. Salmorejo completo"></label>
              <label>Categoría<input name="category" placeholder="Ej. Ensalada, pasta, tostada..."></label>
              <label>Raciones de referencia<input name="servings" type="number" min="1" value="1"></label>
              <label>Tiempo<input name="prepTime" placeholder="15 min"></label>
            </div>
            <fieldset class="dish-meal-types-fieldset">
              <legend>¿En qué comidas encaja esta receta?</legend>
              <p class="small muted">Puedes marcar varias. Estas opciones salen de las comidas definidas en Ajustes.</p>
              <div class="dish-meal-type-grid">
                ${(state.mealTypes || []).map(meal => `
                  <label class="check-row dish-meal-type-option">
                    <input type="checkbox" name="mealTypes" value="${escapeHtml(meal.name)}">
                    <span><strong>${escapeHtml(meal.name)}</strong></span>
                  </label>
                `).join("") || '<p class="muted">Añade primero una comida en Ajustes.</p>'}
              </div>
            </fieldset>
            <label>Etiquetas<input name="tags" placeholder="fácil, mediterránea"></label>
            <label>Notas<textarea name="notes"></textarea></label>
            <label>Pautas de elaboración<textarea name="instructions" placeholder="Un paso por línea. Ej.:
Lavar y cortar los tomates.
Triturar con el pan y el aceite.
Servir frío."></textarea></label>
            <div class="section-title-row recipe-builder-title">
              <div>
                <h3>Ingredientes de la receta</h3>
                <p class="muted small">Añade tantos ingredientes como necesites. Usa el selector para buscar por nombre o familia.</p>
              </div>
              <span class="badge">Dinámico</span>
            </div>
            <div class="recipe-builder" data-recipe-builder>
              <input type="hidden" name="recipeJson" value="[]" data-recipe-json>
              <div class="recipe-builder-lines" data-recipe-lines>
                ${renderRecipeLine(INITIAL_RECIPE_LINE_ID, true)}
              </div>
              <div class="actions wrap recipe-builder-actions">
                <button type="button" class="secondary" data-action="add-recipe-line">Añadir otro ingrediente</button>
                <span class="small muted">Las cantidades se guardan por receta de referencia. Indica raciones arriba si la receta base produce más de una ración.</span>
              </div>
            </div>
            <button>Añadir plato</button>
          </form>
        </div>
      </details>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h2>Recetario</h2>
            <p class="muted">Busca por nombre, categoría, comida, etiqueta, ingrediente o texto de elaboración.</p>
          </div>
          <span class="badge">${state.dishes.length} platos</span>
        </div>
        <label class="quick-search-label">Búsqueda rápida de platos
          <input type="search" class="quick-search" placeholder="Ej. desayuno, salmorejo, tupper, pollo..." data-search-target=".dish-list .dish-item" data-empty-target="dishSearchEmpty">
        </label>
        <div id="dishSearchEmpty" class="search-empty muted" hidden>No hay platos que coincidan con la búsqueda.</div>
        <div class="list dish-list">${state.dishes.map(d => renderDishItem(state, d)).join("")}</div>
      </article>
    </div>
  `;
}

export function renderRecipeLine(lineId, required = false) {
  return `
    <div class="recipe-line dynamic-recipe-line" data-recipe-line data-recipe-line-id="${escapeHtml(lineId)}">
      <input type="hidden" data-recipe-ingredient-id>
      <div class="recipe-ingredient-picker-field">
        <span class="recipe-ingredient-label" data-recipe-ingredient-label>${required ? "Elige el primer ingrediente" : "Ingrediente sin seleccionar"}</span>
        <button type="button" class="secondary" data-action="open-recipe-ingredient-picker" data-recipe-line-id="${escapeHtml(lineId)}">Elegir ingrediente</button>
      </div>
      <label>Cantidad<input data-recipe-qty type="number" min="0" step="0.01" placeholder="Ej. 250"></label>
      <label>Unidad<select data-recipe-unit>${UNIT_OPTIONS.map(unit => `<option>${escapeHtml(unit)}</option>`).join("")}</select></label>
      <button type="button" class="secondary" data-action="remove-recipe-line" data-recipe-line-id="${escapeHtml(lineId)}" ${required ? "disabled" : ""}>Quitar</button>
    </div>
  `;
}

function renderDishItem(state, d) {
  const lines = (d.recipe || []).map(line => {
    const ingredient = state.ingredients.find(i => i.id === line.ingredientId);
    return `${escapeHtml(ingredient?.name || "Ingrediente eliminado")}: ${Number(line.qty).toLocaleString("es-ES")} ${escapeHtml(line.unit)}`;
  }).join(" · ");
  const ingredientNames = (d.recipe || []).map(line => state.ingredients.find(i => i.id === line.ingredientId)?.name || line.ingredientId).join(" ");
  const instructions = Array.isArray(d.instructions) ? d.instructions : [];
  const mealTypes = Array.isArray(d.mealTypes) ? d.mealTypes : [];
  const searchText = [d.name, d.category, mealTypes.join(" "), d.tags?.join(" "), d.prepTime, d.notes, ingredientNames, instructions.join(" ")].join(" ");
  return `
    <div class="item dish-item" data-search="${escapeHtml(searchText)}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(d.name)}</strong>
          <p class="qty-line">${escapeHtml(d.category || "Sin categoría")} · ${escapeHtml(d.prepTime || "")}</p>
          ${mealTypes.length ? `<div class="ux-meal-tags">${mealTypes.map(meal => `<span class="ux-meal-tag">${escapeHtml(meal)}</span>`).join("")}</div>` : `<p class="small muted">Sin comidas compatibles definidas.</p>`}
        </div>
        <span class="badge">${Number(d.servings) || 1} ración</span>
      </div>
      <p class="small">${lines}</p>
      ${instructions.length ? `<details class="recipe-steps"><summary>Ver elaboración</summary><ol>${instructions.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol></details>` : `<p class="small muted">Sin pautas de elaboración.</p>`}
      <div class="row-actions"><button class="danger" data-action="delete-dish" data-dish-id="${escapeHtml(d.id)}">Eliminar</button></div>
    </div>`;
}
