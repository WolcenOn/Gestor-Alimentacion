import "./weekPlannerAssistant.js";
import "./calendarNavigationEnhancements.js";
import "./purchaseScanPriceEnhancements.js";
import "./shoppingFilterStyles.js";
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
  openUsdaModal,
  searchUsdaIntoModal,
  importUsdaFood,
  openWasteModal,
  saveWaste,
  openRecyclingModal,
  saveRecycling
} from "./mainActions.js";
import { formToObject, showAlert } from "./render/ui.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
const JOIN_SESSION_KEY = "gestorMenuSemanal.pendingHouseholdJoin.v1";
const SHOPPING_FILTER_KEY = "gestorMenuSemanal.shoppingStatusFilter.v1";

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

function setShoppingFilter(filter) {
  localStorage.setItem(SHOPPING_FILTER_KEY, filter || "open");
  document.querySelector('[data-tab="shopping"]')?.click();
}

function saveUsdaSettings(form) {
  const data = formToObject(form);
  const cleaned = String(data.usdaApiKey || "").trim();
  if (cleaned) sessionStorage.setItem(USDA_SESSION_KEY, cleaned);
  else sessionStorage.removeItem(USDA_SESSION_KEY);
  showAlert(cleaned ? "API key de USDA guardada solo para esta sesión." : "API key de USDA borrada de esta sesión. Se usará DEMO_KEY para pruebas.");
}

function readJoinCodeFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("invite") || "").trim();
}

function removeJoinCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function mergeJoinedHousehold(household) {
  const api = window.GestorCloudAPI;
  const session = api?.getCloudSession?.();
  if (!api || !session || !household?.id) return;
  const households = Array.isArray(session.households) ? session.households : [];
  const nextHouseholds = households.some(item => item.id === household.id)
    ? households.map(item => item.id === household.id ? household : item)
    : [...households, household];
  api.setCloudSession({
    ...session,
    households: nextHouseholds,
    activeHouseholdId: household.id
  });
}

async function acceptPendingJoin() {
  const api = window.GestorCloudAPI;
  const code = sessionStorage.getItem(JOIN_SESSION_KEY) || "";
  if (!code || !api?.isLoggedIn?.()) return false;
  const result = await api.acceptHouseholdInvite(code);
  mergeJoinedHousehold(result.household);
  sessionStorage.removeItem(JOIN_SESSION_KEY);
  showAlert(`Invitación aceptada. Ya formas parte de ${result.household?.name || "ese hogar"}. Este hogar queda seleccionado para la sincronización.`);
  window.setTimeout(() => window.location.reload(), 700);
  return true;
}

async function prepareInviteFlow() {
  const code = readJoinCodeFromUrl();
  if (code) {
    sessionStorage.setItem(JOIN_SESSION_KEY, code);
    removeJoinCodeFromUrl();
  }
  if (!sessionStorage.getItem(JOIN_SESSION_KEY)) return;
  if (!window.GestorCloudAPI?.isLoggedIn?.()) {
    showAlert("Invitación detectada. Inicia sesión o crea una cuenta cloud para unirte al hogar.");
    document.querySelector('[data-tab="settings"]')?.click();
    return;
  }
  await acceptPendingJoin();
}

document.addEventListener("click", guarded(async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "set-shopping-filter") { stop(event); setShoppingFilter(button.dataset.shoppingFilter); }
  if (action === "accept-pending-household-join") { stop(event); await acceptPendingJoin(); }
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
}), true);

document.addEventListener("submit", guarded(async event => {
  const form = event.target.closest("form");
  if (!form) return;
  if (form.dataset.form === "stock-adjust") { stop(event); saveStockAdjust(form); }
  if (form.dataset.form === "waste") { stop(event); saveWaste(form); }
  if (form.dataset.form === "recycling") { stop(event); saveRecycling(form); }
  if (form.dataset.form === "usda-settings") { stop(event); saveUsdaSettings(form); }
}), true);

window.addEventListener("load", guarded(prepareInviteFlow));
window.GestorInviteFlow = { acceptPending: acceptPendingJoin };
