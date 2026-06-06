import { escapeHtml } from "../utils.js";

export function renderDishes(state) {
  const ingredientOptions = state.ingredients.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} (${escapeHtml(i.unit)})</option>`).join("");
  return `
    <div class="grid cols-2">
      <article class="card">
        <h2>Platos y recetas</h2>
        <p class="muted">Añade recetas con hasta 6 ingredientes. Luego podrás planificarlas en la semana.</p>
        <form data-form="dish">
          <div class="form-grid">
            <label>Nombre<input name="name" required placeholder="Ej. Salmorejo completo"></label>
            <label>Categoría<input name="category" placeholder="Cena ligera"></label>
            <label>Raciones<input name="servings" type="number" min="1" value="2"></label>
            <label>Tiempo<input name="prepTime" placeholder="15 min"></label>
          </div>
          <label>Etiquetas<input name="tags" placeholder="fácil, mediterránea"></label>
          <label>Notas<textarea name="notes"></textarea></label>
          <h3>Ingredientes de la receta</h3>
          ${Array.from({ length: 6 }, (_, index) => `
            <div class="form-grid recipe-line">
              <label>Ingrediente ${index + 1}<select name="ingredientId_${index}"><option value="">—</option>${ingredientOptions}</select></label>
              <label>Cantidad<input name="qty_${index}" type="number" min="0" step="0.01"></label>
              <label>Unidad<select name="unit_${index}"><option>g</option><option>kg</option><option>ml</option><option>l</option><option>unidades</option></select></label>
            </div>`).join("")}
          <button>Añadir plato</button>
        </form>
      </article>
      <article class="card">
        <h2>Recetario</h2>
        <div class="list">${state.dishes.map(d => renderDishItem(state, d)).join("")}</div>
      </article>
    </div>
  `;
}

function renderDishItem(state, d) {
  const lines = (d.recipe || []).map(line => {
    const ingredient = state.ingredients.find(i => i.id === line.ingredientId);
    return `${escapeHtml(ingredient?.name || "Ingrediente eliminado")}: ${Number(line.qty).toLocaleString("es-ES")} ${escapeHtml(line.unit)}`;
  }).join(" · ");
  return `
    <div class="item">
      <div class="item-title">
        <div><strong>${escapeHtml(d.name)}</strong><p class="qty-line">${escapeHtml(d.category || "Sin categoría")} · ${escapeHtml(d.prepTime || "")}</p></div>
        <span class="badge">${Number(d.servings) || 1} raciones</span>
      </div>
      <p class="small">${lines}</p>
      <div class="row-actions"><button class="danger" data-action="delete-dish" data-dish-id="${escapeHtml(d.id)}">Eliminar</button></div>
    </div>`;
}
