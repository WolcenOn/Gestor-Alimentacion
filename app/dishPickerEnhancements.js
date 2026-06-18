import { getState, updateState } from "./store.js";
import { escapeHtml } from "./utils.js";
import { openModal, closeModal, showAlert } from "./render/ui.js";

function capitalize(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Sin categoría";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dishSearchText(state, dish) {
  const ingredientNames = (dish.recipe || [])
    .map(line => state.ingredients.find(ingredient => ingredient.id === line.ingredientId)?.name || "")
    .join(" ");
  return [dish.name, dish.category, (dish.tags || []).join(" "), ingredientNames, dish.notes, (dish.instructions || []).join(" ")].filter(Boolean).join(" ");
}

function groupDishes(state) {
  const grouped = new Map();
  const dishes = [...state.dishes].sort((a, b) => {
    const categoryCompare = capitalize(a.category).localeCompare(capitalize(b.category), "es", { sensitivity: "base" });
    return categoryCompare || String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
  });
  for (const dish of dishes) {
    const category = capitalize(dish.category || "Sin categoría");
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(dish);
  }
  return grouped;
}

function renderDishButton(state, dish, slot) {
  const ingredients = (dish.recipe || [])
    .map(line => state.ingredients.find(ingredient => ingredient.id === line.ingredientId)?.name)
    .filter(Boolean)
    .slice(0, 6);
  const search = dishSearchText(state, dish);
  return `
    <button type="button" class="dish-picker-option" data-action="pick-dish-for-slot" data-slot="${escapeHtml(slot)}" data-dish-id="${escapeHtml(dish.id)}" data-dish-search="${escapeHtml(normalizeText(search))}">
      <span><strong>${escapeHtml(dish.name)}</strong><small>${ingredients.length ? escapeHtml(ingredients.join(" · ")) : "Sin ingredientes registrados"}</small></span>
      <span class="mini-badge">${escapeHtml(String(dish.servings || 1))} r.</span>
    </button>
  `;
}

function renderPicker(slot) {
  const state = getState();
  const grouped = groupDishes(state);
  if (!state.dishes.length) {
    return `
      <header><div><h2>Añadir plato</h2><p class="muted">Todavía no hay platos guardados.</p></div><button class="secondary" data-action="close-modal">×</button></header>
      <p class="alert">Crea platos primero en la pestaña Platos.</p>
    `;
  }

  return `
    <header>
      <div>
        <p class="eyebrow">Selector de platos</p>
        <h2>Añadir plato a la semana</h2>
        <p class="muted">Abre una categoría o busca por nombre, etiqueta, ingrediente o elaboración. Ejemplo: salmón.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <label class="quick-search-label">Buscar en todos los platos
      <input type="search" class="quick-search" data-dish-picker-global placeholder="Ej. salmón, ensalada, arroz, horno...">
    </label>
    <div class="dish-picker-category-list">
      ${[...grouped.entries()].map(([category, dishes], index) => `
        <details class="dish-picker-category" ${index === 0 ? "open" : ""}>
          <summary><strong>${escapeHtml(category)}</strong><span class="mini-badge">${dishes.length}</span></summary>
          <label class="quick-search-label category-search-label">Buscar dentro de ${escapeHtml(category)}
            <input type="search" class="quick-search" data-dish-picker-category-search placeholder="Nombre o ingrediente dentro de esta categoría">
          </label>
          <div class="list dish-picker-options">
            ${dishes.map(dish => renderDishButton(state, dish, slot)).join("")}
          </div>
          <p class="muted dish-picker-empty" hidden>No hay platos que coincidan en esta categoría.</p>
        </details>
      `).join("")}
    </div>
  `;
}

function openDishPicker(slot) {
  openModal(renderPicker(slot));
  document.querySelector("[data-dish-picker-global]")?.focus();
}

function addDishToSlot(slot, dishId) {
  if (!slot || !dishId) return;
  const state = getState();
  const dish = state.dishes.find(item => item.id === dishId);
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    if (!week) return;
    week.plan[slot] ||= [];
    if (!week.plan[slot].includes(dishId)) week.plan[slot].push(dishId);
  }, "plan-add-picker");
  closeModal();
  showAlert(dish ? `${dish.name} añadido a la semana.` : "Plato añadido a la semana.");
}

function applyDishPickerFilters(root) {
  const globalQuery = normalizeText(root.querySelector("[data-dish-picker-global]")?.value || "");
  for (const category of root.querySelectorAll(".dish-picker-category")) {
    const categoryQuery = normalizeText(category.querySelector("[data-dish-picker-category-search]")?.value || "");
    let visible = 0;
    for (const option of category.querySelectorAll("[data-dish-search]")) {
      const text = option.dataset.dishSearch || "";
      const matchesGlobal = !globalQuery || text.includes(globalQuery);
      const matchesCategory = !categoryQuery || text.includes(categoryQuery);
      const show = matchesGlobal && matchesCategory;
      option.hidden = !show;
      if (show) visible += 1;
    }
    const empty = category.querySelector(".dish-picker-empty");
    if (empty) empty.hidden = visible !== 0;
    if (globalQuery && visible) category.open = true;
  }
}

document.addEventListener("click", event => {
  const openButton = event.target.closest('[data-action="open-dish-picker"]');
  if (openButton) {
    event.preventDefault();
    openDishPicker(openButton.dataset.slot || "");
    return;
  }

  const pickButton = event.target.closest('[data-action="pick-dish-for-slot"]');
  if (pickButton) {
    event.preventDefault();
    addDishToSlot(pickButton.dataset.slot || "", pickButton.dataset.dishId || "");
  }
}, true);

document.addEventListener("input", event => {
  if (!event.target.matches("[data-dish-picker-global], [data-dish-picker-category-search]")) return;
  const modal = event.target.closest(".modal");
  if (modal) applyDishPickerFilters(modal);
}, true);

window.GestorDishPicker = { open: openDishPicker };
