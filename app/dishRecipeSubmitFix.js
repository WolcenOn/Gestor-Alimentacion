import { updateState } from "./store.js";
import { withMeta } from "./models.js";
import { formToObject, showAlert } from "./render/ui.js";
import { normalizeUnit, parseNumber, stripDangerousText } from "./utils.js";

function readVisibleRecipe(form) {
  const builder = form.querySelector("[data-recipe-builder]");
  if (!builder) return [];
  return [...builder.querySelectorAll("[data-recipe-line]")]
    .map(line => ({
      ingredientId: String(line.querySelector("[data-recipe-ingredient-id]")?.value || ""),
      qty: parseNumber(line.querySelector("[data-recipe-qty]")?.value),
      unit: normalizeUnit(line.querySelector("[data-recipe-unit]")?.value || "g")
    }))
    .filter(line => line.ingredientId && line.qty > 0);
}

function syncDishRecipeJson(form) {
  const hidden = form.querySelector("[data-recipe-json]");
  const recipe = readVisibleRecipe(form);
  if (hidden) {
    hidden.value = JSON.stringify(recipe);
    hidden.setAttribute("value", hidden.value);
  }
  return recipe;
}

function saveDishFromVisibleRecipe(form) {
  const data = formToObject(form);
  const recipe = syncDishRecipeJson(form);
  if (!recipe.length) throw new Error("Añade al menos un ingrediente con cantidad a la receta.");

  updateState(draft => {
    draft.dishes.push(withMeta({
      name: stripDangerousText(data.name),
      servings: parseNumber(data.servings, 1),
      unit: "raciones",
      category: stripDangerousText(data.category || ""),
      tags: String(data.tags || "").split(",").map(tag => stripDangerousText(tag.trim())).filter(Boolean),
      prepTime: stripDangerousText(data.prepTime || ""),
      difficulty: "",
      approxPrice: 0,
      notes: stripDangerousText(data.notes || ""),
      instructions: String(data.instructions || "").split("\n").map(step => stripDangerousText(step.trim())).filter(Boolean),
      recipe,
      packId: "manual"
    }, "dish"));
  }, "dish-add-visible-recipe");

  form.reset();
  const hidden = form.querySelector("[data-recipe-json]");
  if (hidden) {
    hidden.value = "[]";
    hidden.setAttribute("value", "[]");
  }
  form.querySelectorAll("[data-recipe-line]").forEach((line, index) => {
    if (index > 0) line.remove();
    else {
      const ingredientInput = line.querySelector("[data-recipe-ingredient-id]");
      const label = line.querySelector("[data-recipe-ingredient-label]");
      const pickerButton = line.querySelector('[data-action="open-recipe-ingredient-picker"]');
      if (ingredientInput) ingredientInput.value = "";
      if (label) label.textContent = "Elige el primer ingrediente";
      if (pickerButton) pickerButton.textContent = "Elegir ingrediente";
    }
  });
  showAlert("Plato añadido.");
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="dish"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    saveDishFromVisibleRecipe(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo guardar el plato.", "error");
  }
}, true);

window.GestorDishRecipeSubmitFix = { sync: syncDishRecipeJson, save: saveDishFromVisibleRecipe };
