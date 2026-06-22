import { getState } from "./store.js";
import { escapeHtml } from "./utils.js";
import { openModal, closeModal } from "./render/ui.js";
import { renderRecipeLine } from "./render/dishes.js";

let lineCounter = 1;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientFamilyName(state, ingredient) {
  return state.ingredientFamilies?.find(family => family.id === ingredient.familyId)?.name || "Sin familia";
}

function groupIngredients(state) {
  const grouped = new Map();
  const ingredients = [...state.ingredients].sort((a, b) => {
    const familyCompare = ingredientFamilyName(state, a).localeCompare(ingredientFamilyName(state, b), "es", { sensitivity: "base" });
    return familyCompare || String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
  });
  for (const ingredient of ingredients) {
    const family = ingredientFamilyName(state, ingredient);
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family).push(ingredient);
  }
  return grouped;
}

function renderIngredientOption(state, ingredient, lineId) {
  const family = ingredientFamilyName(state, ingredient);
  const search = normalizeText([ingredient.name, family, ingredient.unit, ingredient.storageType].filter(Boolean).join(" "));
  return `
    <button type="button" class="dish-picker-option recipe-ingredient-option" data-action="pick-recipe-ingredient" data-recipe-line-id="${escapeHtml(lineId)}" data-ingredient-id="${escapeHtml(ingredient.id)}" data-ingredient-unit="${escapeHtml(ingredient.unit || "g")}" data-ingredient-name="${escapeHtml(ingredient.name)}" data-ingredient-search="${escapeHtml(search)}">
      <span><strong>${escapeHtml(ingredient.name)}</strong><small>${escapeHtml(family)} · stock ${Number(ingredient.qty || 0).toLocaleString("es-ES")} ${escapeHtml(ingredient.unit || "")}</small></span>
      <span class="mini-badge">${escapeHtml(ingredient.unit || "")}</span>
    </button>
  `;
}

function renderIngredientPicker(lineId) {
  const state = getState();
  const grouped = groupIngredients(state);
  if (!state.ingredients.length) {
    return `
      <header><div><h2>Elegir ingrediente</h2><p class="muted">Todavía no hay ingredientes guardados.</p></div><button class="secondary" data-action="close-modal">×</button></header>
      <p class="alert">Crea ingredientes primero en la pestaña Ingredientes.</p>
    `;
  }

  return `
    <header>
      <div>
        <p class="eyebrow">Selector de ingredientes</p>
        <h2>Añadir ingrediente a la receta</h2>
        <p class="muted">Busca por nombre, familia, unidad o conservación. Elige uno y completa cantidad.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <label class="quick-search-label">Buscar en todos los ingredientes
      <input type="search" class="quick-search" data-ingredient-picker-global placeholder="Ej. tomate, proteína, g, nevera...">
    </label>
    <div class="dish-picker-category-list recipe-ingredient-category-list">
      ${[...grouped.entries()].map(([family, ingredients], index) => `
        <details class="dish-picker-category recipe-ingredient-category" ${index === 0 ? "open" : ""}>
          <summary><strong>${escapeHtml(family)}</strong><span class="mini-badge">${ingredients.length}</span></summary>
          <label class="quick-search-label category-search-label">Buscar dentro de ${escapeHtml(family)}
            <input type="search" class="quick-search" data-ingredient-picker-category-search placeholder="Nombre o unidad dentro de esta familia">
          </label>
          <div class="list dish-picker-options">
            ${ingredients.map(ingredient => renderIngredientOption(state, ingredient, lineId)).join("")}
          </div>
          <p class="muted ingredient-picker-empty" hidden>No hay ingredientes que coincidan en esta familia.</p>
        </details>
      `).join("")}
    </div>
  `;
}

function openIngredientPicker(lineId) {
  openModal(renderIngredientPicker(lineId));
  document.querySelector("[data-ingredient-picker-global]")?.focus();
}

function addRecipeLine(builder) {
  lineCounter += 1;
  const lineId = `recipe_line_${Date.now()}_${lineCounter}`;
  const lines = builder.querySelector("[data-recipe-lines]");
  if (!lines) return;
  lines.insertAdjacentHTML("beforeend", renderRecipeLine(lineId, false));
  updateRecipeJson(builder);
}

function removeRecipeLine(button) {
  const builder = button.closest("[data-recipe-builder]");
  const line = button.closest("[data-recipe-line]");
  if (!builder || !line || button.disabled) return;
  line.remove();
  if (!builder.querySelector("[data-recipe-line]")) addRecipeLine(builder);
  updateRecipeJson(builder);
}

function pickIngredient(button) {
  const lineId = button.dataset.recipeLineId || "";
  const line = document.querySelector(`[data-recipe-line-id="${CSS.escape(lineId)}"]`);
  if (!line) return;
  const ingredientId = button.dataset.ingredientId || "";
  const ingredientName = button.dataset.ingredientName || "Ingrediente";
  const ingredientUnit = button.dataset.ingredientUnit || "g";

  line.querySelector("[data-recipe-ingredient-id]").value = ingredientId;
  line.querySelector("[data-recipe-ingredient-label]").textContent = ingredientName;
  const pickerButton = line.querySelector('[data-action="open-recipe-ingredient-picker"]');
  if (pickerButton) pickerButton.textContent = "Cambiar";
  const unitSelect = line.querySelector("[data-recipe-unit]");
  if (unitSelect && [...unitSelect.options].some(option => option.value === ingredientUnit || option.textContent === ingredientUnit)) {
    unitSelect.value = ingredientUnit;
  }
  updateRecipeJson(line.closest("[data-recipe-builder]"));
  closeModal();
}

function updateRecipeJson(builder) {
  if (!builder) return;
  const lines = [...builder.querySelectorAll("[data-recipe-line]")];
  const recipe = lines.map(line => ({
    ingredientId: line.querySelector("[data-recipe-ingredient-id]")?.value || "",
    qty: Number(line.querySelector("[data-recipe-qty]")?.value || 0),
    unit: line.querySelector("[data-recipe-unit]")?.value || "g"
  })).filter(line => line.ingredientId && line.qty > 0);
  const hidden = builder.querySelector("[data-recipe-json]");
  if (hidden) hidden.value = JSON.stringify(recipe);
}

function applyIngredientPickerFilters(root) {
  const globalQuery = normalizeText(root.querySelector("[data-ingredient-picker-global]")?.value || "");
  for (const category of root.querySelectorAll(".recipe-ingredient-category")) {
    const categoryQuery = normalizeText(category.querySelector("[data-ingredient-picker-category-search]")?.value || "");
    let visible = 0;
    for (const option of category.querySelectorAll("[data-ingredient-search]")) {
      const text = option.dataset.ingredientSearch || "";
      const matchesGlobal = !globalQuery || text.includes(globalQuery);
      const matchesCategory = !categoryQuery || text.includes(categoryQuery);
      const show = matchesGlobal && matchesCategory;
      option.hidden = !show;
      if (show) visible += 1;
    }
    const empty = category.querySelector(".ingredient-picker-empty");
    if (empty) empty.hidden = visible !== 0;
    if (globalQuery && visible) category.open = true;
  }
}

document.addEventListener("click", event => {
  const addButton = event.target.closest('[data-action="add-recipe-line"]');
  if (addButton) {
    event.preventDefault();
    event.stopPropagation();
    addRecipeLine(addButton.closest("[data-recipe-builder]"));
    return;
  }

  const removeButton = event.target.closest('[data-action="remove-recipe-line"]');
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    removeRecipeLine(removeButton);
    return;
  }

  const openButton = event.target.closest('[data-action="open-recipe-ingredient-picker"]');
  if (openButton) {
    event.preventDefault();
    event.stopPropagation();
    openIngredientPicker(openButton.dataset.recipeLineId || "");
    return;
  }

  const pickButton = event.target.closest('[data-action="pick-recipe-ingredient"]');
  if (pickButton) {
    event.preventDefault();
    event.stopPropagation();
    pickIngredient(pickButton);
  }
}, true);

document.addEventListener("input", event => {
  const builder = event.target.closest("[data-recipe-builder]");
  if (builder && event.target.matches("[data-recipe-qty], [data-recipe-unit]")) updateRecipeJson(builder);

  if (!event.target.matches("[data-ingredient-picker-global], [data-ingredient-picker-category-search]")) return;
  const modal = event.target.closest(".modal");
  if (modal) applyIngredientPickerFilters(modal);
}, true);

document.addEventListener("change", event => {
  const builder = event.target.closest("[data-recipe-builder]");
  if (builder && event.target.matches("[data-recipe-qty], [data-recipe-unit]")) updateRecipeJson(builder);
}, true);

window.GestorRecipeIngredients = {
  openPicker: openIngredientPicker,
  updateRecipeJson
};
