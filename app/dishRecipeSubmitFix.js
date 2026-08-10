import { updateState } from "./store.js";
import { withMeta } from "./models.js";
import { formToObject, showAlert } from "./render/ui.js";
import { normalizeUnit, parseNumber, stripDangerousText } from "./utils.js";

function clearRecipeValidation(form) {
  form.querySelectorAll("[data-recipe-line]").forEach(line => {
    line.classList.remove("recipe-line-error");
    line.removeAttribute("aria-invalid");
    line.querySelector("[data-recipe-line-error]")?.remove();
  });
}

function markRecipeLineError(line, message) {
  line.classList.add("recipe-line-error");
  line.setAttribute("aria-invalid", "true");
  let error = line.querySelector("[data-recipe-line-error]");
  if (!error) {
    error = document.createElement("p");
    error.className = "small error-text recipe-line-error-message";
    error.dataset.recipeLineError = "true";
    line.append(error);
  }
  error.textContent = message;
}

function commitActiveField(form) {
  const active = document.activeElement;
  if (!active || !form.contains(active)) return;
  active.dispatchEvent(new Event("input", { bubbles: true }));
  active.dispatchEvent(new Event("change", { bubbles: true }));
  active.blur?.();
}

function readVisibleRecipe(form) {
  commitActiveField(form);
  clearRecipeValidation(form);

  const builder = form.querySelector("[data-recipe-builder]");
  if (!builder) return { recipe: [], errors: ["No se encontró el bloque de ingredientes de la receta."] };

  const recipe = [];
  const errors = [];
  const lines = [...builder.querySelectorAll("[data-recipe-line]")];

  for (const [index, line] of lines.entries()) {
    const ingredientId = String(line.querySelector("[data-recipe-ingredient-id]")?.value || "");
    const rawQty = String(line.querySelector("[data-recipe-qty]")?.value ?? "").trim();
    const qty = parseNumber(rawQty);
    const unit = normalizeUnit(line.querySelector("[data-recipe-unit]")?.value || "g");
    const isFirstLine = index === 0;
    const hasAnything = ingredientId || rawQty;

    if (!ingredientId && (isFirstLine || rawQty)) {
      const message = "Elige un ingrediente en esta línea.";
      markRecipeLineError(line, message);
      errors.push(message);
      continue;
    }

    if (ingredientId && qty <= 0) {
      const message = "Indica una cantidad mayor que cero.";
      markRecipeLineError(line, message);
      errors.push(message);
      continue;
    }

    if (ingredientId && qty > 0) recipe.push({ ingredientId, qty, unit });
    if (!hasAnything && !isFirstLine) line.classList.remove("recipe-line-error");
  }

  if (errors.length) {
    const firstErrorLine = form.querySelector(".recipe-line-error");
    firstErrorLine?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    firstErrorLine?.querySelector("button, input, select")?.focus?.();
  }

  return { recipe, errors };
}

function syncDishRecipeJson(form) {
  const hidden = form.querySelector("[data-recipe-json]");
  const { recipe, errors } = readVisibleRecipe(form);
  if (hidden) {
    hidden.value = JSON.stringify(recipe);
    hidden.setAttribute("value", hidden.value);
  }
  return { recipe, errors };
}

function saveDishFromVisibleRecipe(form) {
  const data = formToObject(form);
  const { recipe, errors } = syncDishRecipeJson(form);
  if (errors.length) throw new Error("Revisa los campos obligatorios marcados en ingredientes de la receta.");
  if (!String(data.name || "").trim()) throw new Error("Escribe el nombre del plato.");
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
    line.classList.remove("recipe-line-error");
    line.removeAttribute("aria-invalid");
    line.querySelector("[data-recipe-line-error]")?.remove();
    if (index > 0) line.remove();
    else {
      const ingredientInput = line.querySelector("[data-recipe-ingredient-id]");
      const label = line.querySelector("[data-recipe-ingredient-label]");
      const qty = line.querySelector("[data-recipe-qty]");
      const pickerButton = line.querySelector('[data-action="open-recipe-ingredient-picker"]');
      if (ingredientInput) ingredientInput.value = "";
      if (label) label.textContent = "Elige el primer ingrediente";
      if (qty) qty.value = "";
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
