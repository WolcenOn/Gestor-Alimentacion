import { getState, updateState } from "./store.js";
import { parseNumber, escapeHtml } from "./utils.js";
import { openModal, closeModal, formToObject, showAlert } from "./render/ui.js";

const NUTRITION_FIELDS = [
  ["kcal", "Kcal"],
  ["protein", "Proteína (g)"],
  ["carbs", "Hidratos (g)"],
  ["fat", "Grasas (g)"],
  ["fiber", "Fibra (g)"],
  ["sugar", "Azúcares (g)"],
  ["salt", "Sal (g)"],
  ["sodium", "Sodio (g)"]
];

function stop(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function numericInput(name, label, value = 0, step = "0.01") {
  return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="number" min="0" step="${escapeHtml(step)}" value="${escapeHtml(String(value ?? 0))}"></label>`;
}

function openManualNutritionModal(ingredientId) {
  const state = getState();
  const ingredient = state.ingredients.find(item => item.id === ingredientId);
  if (!ingredient) throw new Error("Ingrediente no encontrado.");
  const profile = state.nutritionProfiles.find(item => item.ingredientId === ingredientId) || {};

  openModal(`
    <header>
      <div>
        <h2>Nutrición manual · ${escapeHtml(ingredient.name)}</h2>
        <p class="muted">Rellena los valores por 100 g/ml o por unidad. Estos datos alimentan los cálculos de platos y semana.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <form data-form="manual-nutrition" data-ingredient-id="${escapeHtml(ingredient.id)}">
      <div class="form-grid">
        <label>Base del perfil<input name="per" type="number" min="1" step="1" value="${escapeHtml(String(profile.per || 100))}"></label>
        <label>Unidad<select name="unit">
          ${["g", "ml", "unidades"].map(unit => `<option value="${unit}" ${String(profile.unit || ingredient.unit || "g") === unit ? "selected" : ""}>${unit}</option>`).join("")}
        </select></label>
        ${NUTRITION_FIELDS.map(([name, label]) => numericInput(name, label, profile[name] || 0, name === "kcal" ? "1" : "0.01")).join("")}
      </div>
      <label>Fuente o nota<input name="sourceName" value="${escapeHtml(profile.sourceName || "Manual")}" placeholder="Etiqueta, web, estimación casera..."></label>
      <p class="small muted">Consejo: si introduces valores por 100 g, deja Base = 100 y Unidad = g. Para huevos/unidades, usa Base = 1 y Unidad = unidades.</p>
      <button>Guardar nutrición manual</button>
    </form>
  `);
}

function saveManualNutrition(form) {
  const data = formToObject(form);
  const ingredientId = form.dataset.ingredientId;
  const now = new Date().toISOString();
  const profile = {
    ingredientId,
    per: parseNumber(data.per, 100) || 100,
    unit: data.unit || "g",
    kcal: parseNumber(data.kcal),
    protein: parseNumber(data.protein),
    carbs: parseNumber(data.carbs),
    fat: parseNumber(data.fat),
    fiber: parseNumber(data.fiber),
    sugar: parseNumber(data.sugar),
    salt: parseNumber(data.salt),
    sodium: parseNumber(data.sodium),
    source: "manual",
    sourceName: data.sourceName || "Manual",
    updatedAt: now
  };

  updateState(draft => {
    const ingredient = draft.ingredients.find(item => item.id === ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    const existing = draft.nutritionProfiles.find(item => item.ingredientId === ingredientId);
    if (existing) Object.assign(existing, profile);
    else draft.nutritionProfiles.push({ id: `nutrition_${ingredientId}`, createdAt: now, ...profile });

    ingredient.products ||= [];
    const activeProduct = ingredient.products.find(product => product.activeNutrition) || ingredient.products[0];
    if (activeProduct) {
      activeProduct.nutritionSnapshot = { ...profile };
      ingredient.products.forEach(product => { product.activeNutrition = product === activeProduct; });
    }
    ingredient.updatedAt = now;
  }, "manual-nutrition");

  closeModal();
  showAlert("Nutrición manual guardada.");
}

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="open-manual-nutrition"]');
  if (!button) return;
  try {
    stop(event);
    openManualNutritionModal(button.dataset.ingredientId);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo abrir la nutrición manual.", "error");
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="manual-nutrition"]');
  if (!form) return;
  try {
    stop(event);
    saveManualNutrition(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo guardar la nutrición manual.", "error");
  }
}, true);
