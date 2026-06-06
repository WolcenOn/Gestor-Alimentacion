import { updateState } from "./store.js";
import { withMeta } from "./models.js";
import { stripDangerousText, parseNumber, normalizeUnit } from "./utils.js";
import { showAlert, formToObject } from "./render/ui.js";

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

document.addEventListener("submit", event => {
  const form = event.target.closest("form");
  if (!form || form.dataset.form !== "dish") return;

  try {
    stop(event);
    addDishEnhanced(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo guardar el plato.", "error");
  }
}, true);

function addDishEnhanced(form) {
  const data = formToObject(form);
  const servingsReference = Math.max(parseNumber(data.servings, 1), 1);
  const recipe = [];

  for (let i = 0; i < 6; i++) {
    if (!data[`ingredientId_${i}`]) continue;
    const qty = parseNumber(data[`qty_${i}`]);
    if (qty <= 0) continue;
    recipe.push({
      ingredientId: data[`ingredientId_${i}`],
      qty: qty / servingsReference,
      unit: normalizeUnit(data[`unit_${i}`])
    });
  }

  if (!recipe.length) throw new Error("Añade al menos un ingrediente a la receta.");

  const instructions = String(data.instructions || "")
    .split(/\n+/g)
    .map(step => stripDangerousText(step).trim())
    .filter(Boolean);

  if (!instructions.length) throw new Error("Añade al menos una pauta de elaboración.");

  updateState(draft => {
    draft.dishes.push(withMeta({
      name: stripDangerousText(data.name),
      servings: 1,
      unit: "ración",
      category: stripDangerousText(data.category || ""),
      tags: String(data.tags || "").split(",").map(t => stripDangerousText(t).trim()).filter(Boolean),
      prepTime: stripDangerousText(data.prepTime || ""),
      difficulty: "",
      approxPrice: 0,
      notes: stripDangerousText(data.notes || ""),
      instructions,
      recipe,
      packId: "manual",
      normalizedToServing: true,
      originalServings: servingsReference
    }, "dish"));
  }, "dish-add-enhanced");

  form.reset();
  showAlert("Plato añadido a 1 ración con pautas de elaboración.");
}
