import { getState, updateState } from "./store.js";
import { escapeHtml } from "./utils.js";
import { openModal, showAlert } from "./render/ui.js";

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

function dishMealText(dish) {
  return normalizeText([dish.category, ...(dish.tags || [])].filter(Boolean).join(" "));
}

function mealContextForSlot(state, slot) {
  const mealId = String(slot || "").split("__")[1] || "";
  const meal = state.mealTypes.find(item => item.id === mealId);
  if (!meal) return null;
  const normalized = normalizeText(meal.name || meal.id);
  const aliases = new Set([normalized]);

  if (/desayuno|breakfast/.test(normalized)) ["desayuno", "breakfast"].forEach(value => aliases.add(value));
  if (/comida|almuerzo|lunch/.test(normalized)) ["comida", "almuerzo", "lunch"].forEach(value => aliases.add(value));
  if (/cena|dinner/.test(normalized)) ["cena", "dinner"].forEach(value => aliases.add(value));
  if (/merienda|snack/.test(normalized)) ["merienda", "snack"].forEach(value => aliases.add(value));

  return { id: meal.id, name: meal.name, aliases: [...aliases].filter(Boolean) };
}

function matchesMealContext(dish, context) {
  if (!context) return true;
  const text = dishMealText(dish);
  return context.aliases.some(alias => text.includes(alias));
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

function isDishInSlot(state, slot, dishId) {
  const week = state.weeks.find(item => item.id === state.activeWeekId);
  return Boolean(week?.plan?.[slot]?.includes(dishId));
}

function renderDishButton(state, dish, slot, context) {
  const ingredients = (dish.recipe || [])
    .map(line => state.ingredients.find(ingredient => ingredient.id === line.ingredientId)?.name)
    .filter(Boolean)
    .slice(0, 6);
  const search = dishSearchText(state, dish);
  const added = isDishInSlot(state, slot, dish.id);
  return `
    <button type="button" class="dish-picker-option${added ? " is-added" : ""}" data-action="pick-dish-for-slot" data-slot="${escapeHtml(slot)}" data-dish-id="${escapeHtml(dish.id)}" data-dish-search="${escapeHtml(normalizeText(search))}" data-meal-match="${matchesMealContext(dish, context) ? "true" : "false"}" ${added ? "disabled" : ""}>
      <span><strong>${escapeHtml(dish.name)}</strong><small>${ingredients.length ? escapeHtml(ingredients.join(" · ")) : "Sin ingredientes registrados"}</small></span>
      <span class="mini-badge">${added ? "✓" : `${escapeHtml(String(dish.servings || 1))} r.`}</span>
    </button>
  `;
}

function renderPicker(slot) {
  const state = getState();
  const grouped = groupDishes(state);
  const context = mealContextForSlot(state, slot);
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
        <p class="muted">Busca una receta y añádela. El selector permanece abierto para que puedas completar esta comida de una vez.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    ${context ? `
      <label class="dish-picker-context-filter">
        <input type="checkbox" data-dish-picker-meal-filter checked>
        <span><strong>Solo recetas para ${escapeHtml(context.name)}</strong><small>Usa la categoría o etiquetas declaradas en la receta. Desactívalo para ver todo.</small></span>
      </label>
    ` : ""}
    <label class="quick-search-label">Buscar en los platos visibles
      <input type="search" class="quick-search" data-dish-picker-global placeholder="Ej. salmón, ensalada, arroz, horno...">
    </label>
    <p class="small muted dish-picker-flow-status" data-dish-picker-status>${context ? `Mostrando primero recetas clasificadas para ${escapeHtml(context.name)}.` : "Puedes añadir varios platos sin cerrar este selector."}</p>
    <div class="dish-picker-category-list">
      ${[...grouped.entries()].map(([category, dishes], index) => `
        <details class="dish-picker-category" ${index === 0 ? "open" : ""}>
          <summary><strong>${escapeHtml(category)}</strong><span class="mini-badge" data-category-visible-count>${dishes.length}</span></summary>
          <label class="quick-search-label category-search-label">Buscar dentro de ${escapeHtml(category)}
            <input type="search" class="quick-search" data-dish-picker-category-search placeholder="Nombre o ingrediente dentro de esta categoría">
          </label>
          <div class="list dish-picker-options">
            ${dishes.map(dish => renderDishButton(state, dish, slot, context)).join("")}
          </div>
          <p class="muted dish-picker-empty" hidden>No hay platos que coincidan en esta categoría.</p>
        </details>
      `).join("")}
    </div>
    <p class="muted dish-picker-global-empty" data-dish-picker-global-empty hidden>No hay recetas que coincidan con estos filtros. Prueba a desactivar el filtro por tipo de comida.</p>
  `;
}

function openDishPicker(slot) {
  openModal(renderPicker(slot));
  const modal = document.querySelector("#modalRoot .modal");
  if (modal) applyDishPickerFilters(modal);
  document.querySelector("[data-dish-picker-global]")?.focus();
}

function addDishToSlot(slot, dishId, button) {
  if (!slot || !dishId) return;
  const state = getState();
  const dish = state.dishes.find(item => item.id === dishId);
  const alreadyAdded = isDishInSlot(state, slot, dishId);

  if (!alreadyAdded) {
    updateState(draft => {
      const week = draft.weeks.find(w => w.id === draft.activeWeekId);
      if (!week) return;
      week.plan[slot] ||= [];
      if (!week.plan[slot].includes(dishId)) week.plan[slot].push(dishId);
    }, "plan-add-picker");
  }

  if (button) {
    button.disabled = true;
    button.classList.add("is-added");
    const badge = button.querySelector(".mini-badge");
    if (badge) badge.textContent = "✓";
  }

  const modal = button?.closest(".modal");
  const status = modal?.querySelector("[data-dish-picker-status]");
  if (status) status.textContent = `${dish?.name || "Plato"} añadido. Puedes seguir añadiendo platos o cerrar cuando termines.`;
  showAlert(dish ? `${dish.name} añadido a la semana.` : "Plato añadido a la semana.");
}

function applyDishPickerFilters(root) {
  const globalQuery = normalizeText(root.querySelector("[data-dish-picker-global]")?.value || "");
  const mealFilter = root.querySelector("[data-dish-picker-meal-filter]");
  const contextEnabled = Boolean(mealFilter?.checked);
  let totalVisible = 0;

  for (const category of root.querySelectorAll(".dish-picker-category")) {
    const categoryQuery = normalizeText(category.querySelector("[data-dish-picker-category-search]")?.value || "");
    let visible = 0;
    for (const option of category.querySelectorAll("[data-dish-search]")) {
      const text = option.dataset.dishSearch || "";
      const matchesGlobal = !globalQuery || text.includes(globalQuery);
      const matchesCategory = !categoryQuery || text.includes(categoryQuery);
      const matchesContext = !contextEnabled || option.dataset.mealMatch === "true";
      const show = matchesGlobal && matchesCategory && matchesContext;
      option.hidden = !show;
      if (show) visible += 1;
    }

    totalVisible += visible;
    const empty = category.querySelector(".dish-picker-empty");
    if (empty) empty.hidden = visible !== 0;
    const count = category.querySelector("[data-category-visible-count]");
    if (count) count.textContent = String(visible);

    const shouldHideCategory = visible === 0 && (Boolean(globalQuery) || contextEnabled);
    category.hidden = shouldHideCategory;
    if ((globalQuery || contextEnabled) && visible) category.open = true;
  }

  const globalEmpty = root.querySelector("[data-dish-picker-global-empty]");
  if (globalEmpty) globalEmpty.hidden = totalVisible !== 0;
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
    addDishToSlot(pickButton.dataset.slot || "", pickButton.dataset.dishId || "", pickButton);
  }
}, true);

document.addEventListener("input", event => {
  if (!event.target.matches("[data-dish-picker-global], [data-dish-picker-category-search]")) return;
  const modal = event.target.closest(".modal");
  if (modal) applyDishPickerFilters(modal);
}, true);

document.addEventListener("change", event => {
  if (!event.target.matches("[data-dish-picker-meal-filter]")) return;
  const modal = event.target.closest(".modal");
  if (modal) applyDishPickerFilters(modal);
}, true);

window.GestorDishPicker = { open: openDishPicker };
