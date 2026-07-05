import "./weekPlannerAssistant.js";
import "./calendarNavigationEnhancements.js";
import "./weekDetailsStateEnhancements.js";
import "./purchaseScanPriceEnhancements.js";
import "./shoppingFilterStyles.js";
import "./compactUiEnhancements.js";
import "./smartFoodTranslationEnhancements.js";
import {
  newWeek,
  duplicateWeek,
  clearWeek,
  removeDishFromSlot,
  deleteIngredient,
  deleteDish,
  openEditStockModal,
  saveStockAdjust,
  startPreviewScanner,
  openInlinePurchaseScanner,
  openOpenFoodFactsModal,
  searchOffIntoModal,
  importOffProduct,
  addIngredient,
  updateIngredient,
  addDish,
  updateDish,
  openPurchaseModal,
  savePurchase,
  registerMealConsumption,
  openDishPicker,
  addDishToSlot,
  exportData,
  importDataFile,
  resetLocalData,
  importLocalPack,
  shareShoppingText,
  printShopping,
  printWeek,
  scanIntoPurchaseForm,
  createSnapshot,
  openDishDetailModal,
  openPurchaseHistoryModal,
  openCookingReviewModal,
  openPackDeleteModal,
  deleteInstalledPack,
  openLegalDoc,
  confirmLegalAcceptance
} from "./mainActions.js";
import { getState, setState } from "./store.js";
import { closeModal, showAlert } from "./render/ui.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
const JOIN_SESSION_KEY = "gestorMenuSemanal.pendingHouseholdJoin.v1";
const SHOPPING_FILTER_KEY = "gestorMenuSemanal.shoppingStatusFilter.v1";

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
}

function rerender() {
  setState(getState(), "ui-action");
}

function setShoppingFilter(filter) {
  localStorage.setItem(SHOPPING_FILTER_KEY, filter || "open");
  document.querySelector('[data-tab="shopping"]')?.click();
}

document.addEventListener("click", event => {
  const button = event.target.closest("button, [data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (!action) return;
  if (action === "new-week") { stop(event); newWeek(); }
  if (action === "duplicate-week") { stop(event); duplicateWeek(); }
  if (action === "clear-week") { stop(event); clearWeek(); }
  if (action === "remove-dish-from-slot") { stop(event); removeDishFromSlot(button.dataset.slot, button.dataset.dishId); }
  if (action === "remove-ingredient-from-slot") { stop(event); import("./weekIngredientPlannerEnhancements.js").then(mod => mod.removeIngredientFromWeekSlot?.(button.dataset.slot, button.dataset.lineId)); }
  if (action === "delete-ingredient") { stop(event); deleteIngredient(button.dataset.id); }
  if (action === "delete-dish") { stop(event); deleteDish(button.dataset.id); }
  if (action === "edit-stock") { stop(event); openEditStockModal(button.dataset.id); }
  if (action === "open-purchase") { stop(event); openPurchaseModal(button.dataset.id); }
  if (action === "open-dish-picker") { stop(event); openDishPicker(button.dataset.slot); }
  if (action === "open-dish-detail") { stop(event); openDishDetailModal(button.dataset.dishId); }
  if (action === "open-purchase-history") { stop(event); openPurchaseHistoryModal(button.dataset.id); }
  if (action === "open-cooking-review") { stop(event); openCookingReviewModal(button.dataset.day); }
  if (action === "register-meal-consumption") { stop(event); registerMealConsumption(button.dataset.day, button.dataset.mealId); }
  if (action === "open-pack-delete") { stop(event); openPackDeleteModal(button.dataset.packId); }
  if (action === "open-legal-doc") { stop(event); openLegalDoc(button.dataset.legalDoc); }
  if (action === "confirm-legal-acceptance") { stop(event); confirmLegalAcceptance(button.dataset.docId); }
  if (action === "start-preview-scanner") { stop(event); startPreviewScanner(); }
  if (action === "inline-purchase-scan") { stop(event); openInlinePurchaseScanner(button.dataset.id); }
  if (action === "open-off-modal") { stop(event); openOpenFoodFactsModal(); }
  if (action === "search-off-modal") { stop(event); searchOffIntoModal(); }
  if (action === "import-off-product") { stop(event); importOffProduct(button.dataset.offId); }
  if (action === "scan-purchase") { stop(event); scanIntoPurchaseForm(); }
  if (action === "export-data") { stop(event); exportData(getState()); }
  if (action === "reset-local") { stop(event); resetLocalData(); }
  if (action === "share-shopping") { stop(event); shareShoppingText(getState()); }
  if (action === "print-shopping") { stop(event); printShopping(getState()); }
  if (action === "print-week") { stop(event); printWeek(getState()); }
  if (action === "create-snapshot") { stop(event); createSnapshot(); }
  if (action === "close-modal") { stop(event); closeModal(); }
  if (action === "set-shopping-filter") { stop(event); setShoppingFilter(button.dataset.shoppingFilter); }
});

document.addEventListener("submit", event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const type = form.dataset.form;
  if (!type) return;
  stop(event);
  if (type === "ingredient") form.dataset.id ? updateIngredient(form) : addIngredient(form);
  if (type === "dish") form.dataset.id ? updateDish(form) : addDish(form);
  if (type === "stock") saveStockAdjust(form);
  if (type === "purchase") savePurchase(form);
  if (type === "delete-installed-pack") deleteInstalledPack(form);
  if (type === "api-key") saveApiKey(form);
});

document.addEventListener("change", event => {
  if (event.target?.id === "importFile") {
    importDataFile(event.target.files?.[0]);
    event.target.value = "";
  }
  if (event.target?.id === "packFile") {
    importLocalPack(event.target.files?.[0]);
    event.target.value = "";
  }
});

function saveApiKey(form) {
  const key = form.elements.usdaApiKey?.value?.trim();
  if (!key) {
    sessionStorage.removeItem(USDA_SESSION_KEY);
    showAlert("Clave USDA eliminada de esta sesión.");
    return;
  }
  sessionStorage.setItem(USDA_SESSION_KEY, key);
  showAlert("Clave USDA guardada solo para esta sesión.");
}

window.__gestorMenuActions = { rerender };
