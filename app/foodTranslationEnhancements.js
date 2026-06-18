import { translateFoodQueryToEnglish } from "./services/foodTranslation.js";

function translatedInfoText(result) {
  if (!result.query) return "Escribe un alimento en español o inglés.";
  if (result.translated) return `Se buscará en USDA como: ${result.query}`;
  return `Búsqueda USDA: ${result.query}`;
}

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

function previewTranslation() {
  const input = document.getElementById("usdaSearchQuery");
  if (!input) return null;
  const result = translateFoodQueryToEnglish(input.value || "");
  const box = ensureInfoBox(input);
  if (box) box.textContent = translatedInfoText(result);
  return result;
}

function applyTranslationBeforeSearch() {
  const input = document.getElementById("usdaSearchQuery");
  if (!input) return;
  const result = translateFoodQueryToEnglish(input.value || "");
  const box = ensureInfoBox(input);
  if (box) box.textContent = translatedInfoText(result);
  if (result.query && result.translated) {
    input.dataset.originalQuery = input.value;
    input.value = result.query;
  }
}

document.addEventListener("input", event => {
  if (event.target?.id === "usdaSearchQuery") previewTranslation();
}, true);

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="search-usda-foods"]');
  if (!button) return;
  applyTranslationBeforeSearch();
}, true);

window.GestorFoodTranslation = {
  translate: translateFoodQueryToEnglish,
  previewUsda: previewTranslation
};
