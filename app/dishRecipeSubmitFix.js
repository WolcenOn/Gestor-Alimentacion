function syncDishRecipeJson(form) {
  const builder = form.querySelector("[data-recipe-builder]");
  const hidden = form.querySelector("[data-recipe-json]");
  if (!builder || !hidden) return;

  const recipe = [...builder.querySelectorAll("[data-recipe-line]")]
    .map(line => ({
      ingredientId: line.querySelector("[data-recipe-ingredient-id]")?.value || "",
      qty: Number(line.querySelector("[data-recipe-qty]")?.value || 0),
      unit: line.querySelector("[data-recipe-unit]")?.value || "g"
    }))
    .filter(line => line.ingredientId && line.qty > 0);

  hidden.value = JSON.stringify(recipe);
  hidden.setAttribute("value", hidden.value);
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="dish"]');
  if (!form) return;
  syncDishRecipeJson(form);
}, true);

window.GestorDishRecipeSubmitFix = { sync: syncDishRecipeJson };
