import {
  newWeek,
  duplicateWeek,
  clearWeek,
  removeDishFromSlot,
  deleteIngredient,
  deleteDish,
  openEditStockModal,
  saveStockAdjust,
  listPacksIntoUi,
  previewRemotePack,
  installPreviewedPack,
  generatePackPrompt,
  copyPackPrompt,
  startPreviewScanner,
  openInlinePurchaseScanner,
  openOpenFoodFactsModal,
  searchOffIntoModal,
  importOffProduct,
  openUsdaModal,
  searchUsdaIntoModal,
  importUsdaFood,
  openWasteModal,
  saveWaste,
  openRecyclingModal,
  saveRecycling
} from "./mainActions.js";
import { formToObject, getSubmitterValue, showAlert } from "./render/ui.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";

function guarded(fn) {
  return async (...args) => {
    try { await fn(...args); }
    catch (error) { console.error(error); showAlert(error.message || "Ha ocurrido un error.", "error"); }
  };
}

function stop(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function saveUsdaSettings(form) {
  const data = formToObject(form);
  const cleaned = String(data.usdaApiKey || "").trim();
  if (cleaned) sessionStorage.setItem(USDA_SESSION_KEY, cleaned);
  else sessionStorage.removeItem(USDA_SESSION_KEY);
  showAlert(cleaned ? "API key de USDA guardada solo para esta sesión." : "API key de USDA borrada de esta sesión. Se usará DEMO_KEY para pruebas.");
}

document.addEventListener("click", guarded(async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "new-week") { stop(event); newWeek(); }
  if (action === "duplicate-week") { stop(event); duplicateWeek(); }
  if (action === "clear-week") { stop(event); clearWeek(); }
  if (action === "delete-ingredient") { stop(event); deleteIngredient(button.dataset.ingredientId); }
  if (action === "delete-dish") { stop(event); deleteDish(button.dataset.dishId); }
  if (action === "edit-stock") { stop(event); openEditStockModal(button.dataset.ingredientId); }
  if (action === "remove-dish-from-slot") { stop(event); removeDishFromSlot(button.dataset.slot, button.dataset.dishId); }
  if (action === "open-purchase-scanner") { stop(event); openInlinePurchaseScanner(); }
  if (action === "start-preview-scan") { stop(event); await startPreviewScanner(); }
  if (action === "open-off-search") { stop(event); openOpenFoodFactsModal(button.dataset.ingredientId || ""); }
  if (action === "search-off-products") { stop(event); await searchOffIntoModal(); }
  if (action === "import-off-product") { stop(event); importOffProduct(Number(button.dataset.index), button.dataset.ingredientId || ""); }
  if (action === "open-usda-search") { stop(event); openUsdaModal(button.dataset.ingredientId || ""); }
  if (action === "search-usda-foods") { stop(event); await searchUsdaIntoModal(); }
  if (action === "import-usda-food") { stop(event); importUsdaFood(Number(button.dataset.index), button.dataset.ingredientId || ""); }
  if (action === "open-waste-modal") { stop(event); openWasteModal(button.dataset.ingredientId); }
  if (action === "open-recycling-modal") { stop(event); openRecyclingModal(); }
  if (action === "list-remote-packs") { stop(event); await listPacksIntoUi(); }
  if (action === "preview-remote-pack") { stop(event); await previewRemotePack(button.dataset.index); }
  if (action === "install-remote-pack") { stop(event); await previewRemotePack(button.dataset.index); }
  if (action === "copy-pack-prompt") { stop(event); await copyPackPrompt(); }
}), true);

document.addEventListener("submit", guarded(async event => {
  const form = event.target.closest("form");
  if (!form) return;
  if (form.dataset.form === "stock-adjust") { stop(event); saveStockAdjust(form); }
  if (form.dataset.form === "waste") { stop(event); saveWaste(form); }
  if (form.dataset.form === "recycling") { stop(event); saveRecycling(form); }
  if (form.dataset.form === "usda-settings") { stop(event); saveUsdaSettings(form); }
  if (form.dataset.form === "pack-install") { stop(event); installPreviewedPack(form, event); }
  if (form.dataset.form === "pack-prompt") { stop(event); generatePackPrompt(form); }
}), true);
