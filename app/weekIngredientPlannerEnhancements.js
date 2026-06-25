import { getState, updateState } from "./store.js";
import { uid } from "./utils.js";
import { escapeHtml, formatQty, normalizeUnit, parseNumber } from "./utils.js";
import { openModal, closeModal, showAlert, formToObject } from "./render/ui.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientSearchText(state, ingredient) {
  const family = state.ingredientFamilies.find(item => item.id === ingredient.familyId)?.name || "";
  const products = (ingredient.products || []).map(product => [product.productName, product.brand, product.barcode].filter(Boolean).join(" ")).join(" ");
  return normalizeText([ingredient.name, family, ingredient.unit, products].filter(Boolean).join(" "));
}

function renderIngredientOption(state, ingredient, slot) {
  const family = state.ingredientFamilies.find(item => item.id === ingredient.familyId)?.name || "Sin familia";
  const defaultQty = ingredient.unit === "unidades" ? 1 : ingredient.unit === "ml" ? 250 : ingredient.unit === "g" ? 100 : 1;
  return `
    <article class="item week-ingredient-option" data-week-ingredient-search="${escapeHtml(ingredientSearchText(state, ingredient))}">
      <div>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <p class="qty-line">Stock: ${escapeHtml(formatQty(ingredient.qty, ingredient.unit))} · ${escapeHtml(family)}</p>
      </div>
      <form data-form="week-ingredient-plan" data-slot="${escapeHtml(slot)}" data-ingredient-id="${escapeHtml(ingredient.id)}">
        <div class="form-grid compact-form-grid">
          <label>Cantidad<input name="qty" type="number" min="0.01" step="0.01" value="${escapeHtml(String(defaultQty))}" required></label>
          <label>Unidad<select name="unit">${["g", "kg", "ml", "l", "unidades"].map(unit => `<option ${normalizeUnit(ingredient.unit) === unit ? "selected" : ""}>${unit}</option>`).join("")}</select></label>
        </div>
        <div class="actions"><button type="submit" class="secondary">Añadir ingrediente</button></div>
      </form>
    </article>
  `;
}

function renderPicker(slot) {
  const state = getState();
  const ingredients = [...state.ingredients].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" }));
  return `
    <header>
      <div>
        <p class="eyebrow">Ingrediente directo</p>
        <h2>Añadir ingrediente a la semana</h2>
        <p class="muted">Útil para fruta, yogures, pan, bebida, o platos preparados que no quieres convertir en receta.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <label class="quick-search-label">Buscar ingrediente
      <input type="search" class="quick-search" data-week-ingredient-search-input placeholder="Ej. plátano, yogur, pizza, leche...">
    </label>
    <div class="list week-ingredient-picker-list">
      ${ingredients.length ? ingredients.map(ingredient => renderIngredientOption(state, ingredient, slot)).join("") : `<p class="alert">Todavía no hay ingredientes guardados.</p>`}
    </div>
    <p class="muted week-ingredient-empty" hidden>No hay ingredientes que coincidan.</p>
  `;
}

function openWeekIngredientPicker(slot) {
  if (!slot) return;
  openModal(renderPicker(slot));
  document.querySelector("[data-week-ingredient-search-input]")?.focus();
}

function addIngredientToSlot(form) {
  const data = formToObject(form);
  const slot = form.dataset.slot || "";
  const ingredientId = form.dataset.ingredientId || "";
  const qty = parseNumber(data.qty);
  const unit = normalizeUnit(data.unit);
  if (!slot || !ingredientId || qty <= 0) throw new Error("Selecciona ingrediente y cantidad.");

  let ingredientName = "Ingrediente";
  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    const week = draft.weeks.find(item => item.id === draft.activeWeekId);
    if (!week) throw new Error("Semana no encontrada.");
    week.ingredientPlan ||= {};
    week.ingredientPlan[slot] ||= [];
    week.ingredientPlan[slot].push({
      id: uid("week_ing"),
      ingredientId,
      qty,
      unit,
      source: "direct-ingredient",
      createdAt: new Date().toISOString()
    });
    ingredientName = ingredient.name;
  }, "week-ingredient-add");

  closeModal();
  showAlert(`${ingredientName} añadido a la semana.`);
}

function removeIngredientFromSlot(slot, lineId) {
  if (!slot || !lineId) return;
  updateState(draft => {
    const week = draft.weeks.find(item => item.id === draft.activeWeekId);
    if (!week?.ingredientPlan?.[slot]) return;
    week.ingredientPlan[slot] = week.ingredientPlan[slot].filter(line => line.id !== lineId);
    if (!week.ingredientPlan[slot].length) delete week.ingredientPlan[slot];
  }, "week-ingredient-remove");
  showAlert("Ingrediente quitado de la semana.");
}

function applyIngredientFilter(root) {
  const query = normalizeText(root.querySelector("[data-week-ingredient-search-input]")?.value || "");
  let visible = 0;
  for (const option of root.querySelectorAll("[data-week-ingredient-search]")) {
    const show = !query || String(option.dataset.weekIngredientSearch || "").includes(query);
    option.hidden = !show;
    if (show) visible += 1;
  }
  const empty = root.querySelector(".week-ingredient-empty");
  if (empty) empty.hidden = visible !== 0;
}

document.addEventListener("click", event => {
  const openButton = event.target.closest('[data-action="open-week-ingredient-picker"]');
  if (openButton) {
    event.preventDefault();
    openWeekIngredientPicker(openButton.dataset.slot || "");
    return;
  }

  const removeButton = event.target.closest('[data-action="remove-ingredient-from-slot"]');
  if (removeButton) {
    event.preventDefault();
    removeIngredientFromSlot(removeButton.dataset.slot || "", removeButton.dataset.lineId || "");
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="week-ingredient-plan"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    addIngredientToSlot(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo añadir el ingrediente a la semana.", "error");
  }
}, true);

document.addEventListener("input", event => {
  if (!event.target.matches("[data-week-ingredient-search-input]")) return;
  const modal = event.target.closest(".modal");
  if (modal) applyIngredientFilter(modal);
}, true);

window.GestorWeekIngredientPlanner = { open: openWeekIngredientPicker };
