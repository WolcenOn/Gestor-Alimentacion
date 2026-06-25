import "./scannedPurchaseIngredientEnhancements.js";
import "./dishRecipeSubmitFix.js";
import { translateFoodQueryToEnglish } from "./services/foodTranslationSmart.js";

function ensureInfoBox(input) {
  const panel = input.closest(".search-panel");
  if (!panel) return null;
  let box = panel.querySelector("[data-usda-translation-info]");
  if (!box) {
    box = document.createElement("p");
    box.className = "qty-line";
    box.dataset.usdaTranslationInfo = "true";
    input.closest("label")?.insertAdjacentElement("afterend", box);
  }
  return box;
}

function applySmartTranslation() {
  const input = document.getElementById("usdaSearchQuery");
  if (!input) return null;
  const rawQuery = input.dataset.originalQuery || input.value || "";
  const result = translateFoodQueryToEnglish(rawQuery);
  const box = ensureInfoBox(input);
  if (box && result.query) box.textContent = `Se buscará en USDA como: ${result.query}`;
  if (result.query && result.translated) {
    input.dataset.originalQuery = rawQuery;
    input.value = result.query;
  }
  return result;
}

document.addEventListener("input", event => {
  if (event.target?.id !== "usdaSearchQuery") return;
  applySmartTranslation();
}, true);

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="search-usda-foods"]');
  if (!button) return;
  applySmartTranslation();
}, true);

window.GestorSmartFoodTranslation = {
  translate: translateFoodQueryToEnglish,
  apply: applySmartTranslation
};
