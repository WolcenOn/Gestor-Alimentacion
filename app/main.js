import { getState, updateState, setState, subscribe, resetDemoData, migrateData } from "./store.js";
import { withMeta } from "./models.js";
import { escapeHtml, stripDangerousText, parseNumber, downloadTextFile, readFileAsText, safeJsonParse, normalizeUnit } from "./utils.js";
import { validateState, validatePack } from "./validation.js";
import { renderDashboard } from "./render/dashboard.js";
import { renderIngredients } from "./render/ingredients.js";
import { renderDishes } from "./render/dishes.js";
import { renderCalendar } from "./render/calendar.js";
import { renderShopping } from "./render/shopping.js";
import { renderPacks } from "./render/packs.js";
import { renderHelp } from "./render/help.js";
import { renderSettings } from "./render/settings.js";
import { renderNutrition } from "./render/nutrition.js";
import { showAlert, openModal, closeModal, renderPurchaseModal, renderBarcodeScannerModal, formToObject, getSubmitterValue } from "./render/ui.js";
import { printShopping } from "./print/printShopping.js";
import { printWeek } from "./print/printWeek.js";
import { registerPurchase } from "./state/stock.js";
import { computeShoppingListWithProgress } from "./state/shoppingProgress.js";
import { createWeeklySnapshot } from "./state/history.js";
import { lookupOpenFoodFacts, searchOpenFoodFacts, nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { scanBarcodeOnce, scanBarcodeWithPreview } from "./services/barcodeScanner.js";
import { listRemotePacks, loadRemotePack, mergePackIntoState } from "./services/packLoader.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { registerWaste, registerRecycling, normalizePackagingType } from "./state/wasteRecycling.js";

let activeTab = "dashboard";
const viewRoot = document.getElementById("viewRoot");

function render() {
  const state = getState();
  document.querySelectorAll("[data-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === activeTab));
  const views = {
    dashboard: renderDashboard,
    ingredients: renderIngredients,
    dishes: renderDishes,
    calendar: renderCalendar,
    shopping: renderShopping,
    packs: renderPacks,
    nutrition: renderNutrition,
    settings: renderSettings,
    help: () => renderHelp()
  };
  viewRoot.innerHTML = views[activeTab](state);
}

subscribe(render);
render();
window.onafterprint = () => delete document.body.dataset.printMode;

function guarded(fn) {
  return async (...args) => {
    try { await fn(...args); }
    catch (error) { console.error(error); showAlert(error.message || "Ha ocurrido un error.", "error"); }
  };
}

document.addEventListener("click", guarded(async event => {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    activeTab = tab.dataset.tab;
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const state = getState();

  if (action === "close-modal") closeModal();
  if (action === "manual-shopping-item") openModal(renderPurchaseModal(state, button.dataset.ingredientId, "manual"));
  if (action === "scan-shopping-item") openModal(renderPurchaseModal(state, button.dataset.ingredientId, "scan"));
  if (action === "print-shopping") printShopping(state);
  if (action === "print-week") printWeek(state);
  if (action === "export-data") exportData(state);
  if (action === "share-shopping") shareShoppingText(state);
  if (action === "create-snapshot") {
    updateState(draft => createWeeklySnapshot(draft), "snapshot");
    showAlert("Snapshot semanal guardado.");
  }
  if (action === "new-week") newWeek();
  if (action === "duplicate-week") duplicateWeek();
  if (action === "clear-week") clearWeek();
  if (action === "delete-ingredient") deleteIngredient(button.dataset.ingredientId);
  if (action === "delete-dish") deleteDish(button.dataset.dishId);
  if (action === "delete-family-member") deleteFamilyMember(button.dataset.memberId);
  if (action === "delete-meal-type") deleteMealType(button.dataset.mealId);
  if (action === "edit-stock") openEditStockModal(button.dataset.ingredientId);
  if (action === "remove-dish-from-slot") removeDishFromSlot(button.dataset.slot, button.dataset.dishId);
  if (action === "scan-now") await scanIntoPurchaseForm();
  if (action === "open-purchase-scanner") openInlinePurchaseScanner();
  if (action === "start-preview-scan") await startPreviewScanner();
  if (action === "scan-new-ingredient") openModal(renderBarcodeScannerModal({ title: "Escanear nuevo alimento", target: "ingredient", ingredientId: "" }));
  if (action === "open-off-search") openOpenFoodFactsModal(button.dataset.ingredientId || "");
  if (action === "import-off-product") importOffProduct(Number(button.dataset.index), button.dataset.ingredientId || "");
  if (action === "search-off-products") await searchOffIntoModal();
  if (action === "open-usda-search") openUsdaModal(button.dataset.ingredientId || "");
  if (action === "search-usda-foods") await searchUsdaIntoModal();
  if (action === "import-usda-food") importUsdaFood(Number(button.dataset.index), button.dataset.ingredientId || "");
  if (action === "open-waste-modal") openWasteModal(button.dataset.ingredientId);
  if (action === "open-recycling-modal") openRecyclingModal();
  if (action === "list-remote-packs") await listPacksIntoUi();
  if (action === "install-remote-pack") await installRemotePack(button.dataset.index);
}));

document.addEventListener("change", guarded(async event => {
  const select = event.target.closest('[data-action="add-dish-to-slot"]');
  if (select && select.value) {
    const slot = select.dataset.slot;
    const dishId = select.value;
    updateState(draft => {
      const week = draft.weeks.find(w => w.id === draft.activeWeekId);
      week.plan[slot] ||= [];
      if (!week.plan[slot].includes(dishId)) week.plan[slot].push(dishId);
    }, "plan-add");
    showAlert("Plato añadido a la semana.");
  }

  if (event.target.id === "importFile") await importDataFile(event.target.files[0]);
  if (event.target.id === "packFile") await importLocalPack(event.target.files[0]);
}));

document.addEventListener("submit", guarded(async event => {
  const form = event.target;
  if (!form.matches("form")) return;
  event.preventDefault();
  if (form.dataset.form === "ingredient") addIngredient(form);
  if (form.dataset.form === "dish") addDish(form);
  if (form.dataset.form === "purchase") await savePurchase(form, event);
  if (form.dataset.form === "stock-adjust") saveStockAdjust(form);
  if (form.dataset.form === "waste") saveWaste(form);
  if (form.dataset.form === "recycling") saveRecycling(form);
  if (form.dataset.form === "family-member") addFamilyMember(form);
  if (form.dataset.form === "meal-type") addMealType(form);
  if (form.dataset.form === "usda-settings") saveUsdaSettings(form);
}));

function addIngredient(form) {
  const data = formToObject(form);
  updateState(draft => {
    draft.ingredients.push(withMeta({
      name: stripDangerousText(data.name),
      familyId: data.familyId,
      qty: parseNumber(data.qty),
      unit: normalizeUnit(data.unit),
      available: parseNumber(data.qty) > 0,
      storageType: data.storageType,
      expiryDate: data.expiryDate || "",
      dateType: data.dateType || "none",
      approxPrice: parseNumber(data.approxPrice),
      packagingType: data.packagingType || "otro",
      products: data.barcode ? [{
        barcode: stripDangerousText(data.barcode),
        brand: stripDangerousText(data.brand || ""),
        productName: stripDangerousText(data.productName || data.name),
        packageQty: parseNumber(data.qty),
        packageUnit: normalizeUnit(data.unit),
        price: parseNumber(data.approxPrice),
        source: "manual",
        packagingType: data.packagingType || "otro",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }] : []
    }, "ingredient"));
  }, "ingredient-add");
  form.reset();
  showAlert("Ingrediente añadido.");
}

function addDish(form) {
  const data = formToObject(form);
  const recipe = [];
  for (let i = 0; i < 6; i++) {
    if (!data[`ingredientId_${i}`]) continue;
    const qty = parseNumber(data[`qty_${i}`]);
    if (qty <= 0) continue;
    recipe.push({ ingredientId: data[`ingredientId_${i}`], qty, unit: normalizeUnit(data[`unit_${i}`]) });
  }
  if (!recipe.length) throw new Error("Añade al menos un ingrediente a la receta.");
  updateState(draft => {
    draft.dishes.push(withMeta({
      name: stripDangerousText(data.name),
      servings: parseNumber(data.servings, 1),
      unit: "raciones",
      category: stripDangerousText(data.category || ""),
      tags: String(data.tags || "").split(",").map(t => stripDangerousText(t)).filter(Boolean),
      prepTime: stripDangerousText(data.prepTime || ""),
      difficulty: "",
      approxPrice: 0,
      notes: stripDangerousText(data.notes || ""),
      recipe,
      packId: "manual"
    }, "dish"));
  }, "dish-add");
  form.reset();
  showAlert("Plato añadido.");
}

function addFamilyMember(form) {
  const data = formToObject(form);
  const name = stripDangerousText(data.name || "");
  if (!name) throw new Error("Escribe un nombre para el miembro.");
  updateState(draft => {
    const exists = draft.familyMembers.some(m => m.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) throw new Error("Ese miembro ya existe.");
    draft.familyMembers.push(withMeta({ name, nutritionTargetId: null }, "member"));
  }, "member-add");
  form.reset();
  showAlert("Miembro añadido. Ya aparece en la planificación semanal.");
}

function addMealType(form) {
  const data = formToObject(form);
  const name = stripDangerousText(data.name || "");
  if (!name) throw new Error("Escribe un nombre para la comida.");
  updateState(draft => {
    const exists = draft.mealTypes.some(m => m.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) throw new Error("Ese tipo de comida ya existe.");
    draft.mealTypes.push(withMeta({ name }, "meal"));
  }, "meal-add");
  form.reset();
  showAlert("Comida añadida. Ya aparece en la semana.");
}

function saveUsdaSettings(form) {
  const data = formToObject(form);
  setSessionUsdaApiKey(data.usdaApiKey || "");
  showAlert(data.usdaApiKey ? "API key de USDA guardada solo para esta sesión." : "API key de USDA borrada de esta sesión. Se usará DEMO_KEY para pruebas.");
}

function deleteFamilyMember(memberId) {
  const state = getState();
  const member = state.familyMembers.find(m => m.id === memberId);
  if (!member || state.familyMembers.length <= 1) return;
  if (!confirm(`¿Quitar a ${member.name}? Se eliminarán sus platos planificados.`)) return;
  updateState(draft => {
    draft.familyMembers = draft.familyMembers.filter(m => m.id !== memberId);
    draft.weeks.forEach(week => {
      Object.keys(week.plan || {}).forEach(slot => {
        if (slot.endsWith(`__${memberId}`)) delete week.plan[slot];
      });
    });
  }, "member-delete");
  showAlert("Miembro eliminado y planificación asociada limpiada.");
}

function deleteMealType(mealId) {
  const state = getState();
  const meal = state.mealTypes.find(m => m.id === mealId);
  if (!meal || state.mealTypes.length <= 1) return;
  if (!confirm(`¿Quitar ${meal.name}? Se eliminarán sus platos planificados.`)) return;
  updateState(draft => {
    draft.mealTypes = draft.mealTypes.filter(m => m.id !== mealId);
    draft.weeks.forEach(week => {
      Object.keys(week.plan || {}).forEach(slot => {
        const parts = slot.split("__");
        if (parts[1] === mealId) delete week.plan[slot];
      });
    });
  }, "meal-delete");
  showAlert("Tipo de comida eliminado y planificación asociada limpiada.");
}

async function savePurchase(form, event) {
  const data = formToObject(form);
  const mode = getSubmitterValue(event, "purchaseMode");
  const state = getState();
  const item = computeShoppingListWithProgress(state).find(i => i.ingredientId === form.dataset.ingredientId);
  let purchasedQty = parseNumber(data.purchasedQty);
  if (mode === "complete" && item?.remainingQty) purchasedQty = item.remainingQty;

  let offProduct = null;
  if (data.barcode) {
    const local = state.ingredients.flatMap(i => (i.products || []).map(p => ({ ...p, ingredientId: i.id }))).find(p => p.barcode === data.barcode);
    if (!local) {
      try { offProduct = await lookupOpenFoodFacts(data.barcode); }
      catch { /* offline is acceptable */ }
    }
  }

  updateState(draft => registerPurchase(draft, {
    ingredientId: form.dataset.ingredientId,
    weekId: draft.activeWeekId,
    requiredQty: parseNumber(form.dataset.requiredQty),
    purchasedQty,
    unit: normalizeUnit(data.unit),
    barcode: data.barcode || "",
    brand: stripDangerousText(data.brand || offProduct?.brand || ""),
    productName: stripDangerousText(data.productName || offProduct?.productName || ""),
    productSource: offProduct ? "openfoodfacts" : "manual",
    price: parseNumber(data.price),
    purchaseDate: data.purchaseDate,
    expiryDate: data.expiryDate,
    dateType: data.dateType,
    storageType: data.storageType,
    isPartial: mode !== "complete",
    source: "shopping-list",
    packagingType: data.packagingType || "otro",
    packagingQty: parseNumber(data.packagingQty)
  }), "purchase");
  closeModal();
  showAlert(mode === "complete" ? "Compra completa guardada y stock actualizado." : "Compra parcial guardada y stock actualizado.");
}

async function scanIntoPurchaseForm() {
  const form = document.querySelector('form[data-form="purchase"]');
  if (!form) return;
  const barcode = await scanBarcodeOnce();
  form.elements.barcode.value = barcode;
  const product = await lookupOpenFoodFacts(barcode);
  if (product) {
    form.elements.brand.value = product.brand || "";
    form.elements.productName.value = product.productName || "";
    if (product.packageQty) form.elements.purchasedQty.value = product.packageQty;
    if (product.packageUnit) form.elements.unit.value = normalizeUnit(product.packageUnit);
    showAlert("Producto encontrado en Open Food Facts.");
  } else {
    showAlert("Código detectado, pero no encontrado en Open Food Facts. Puedes guardarlo manualmente.");
  }
}

function exportData(state) {
  downloadTextFile(`gestor-menu-semanal-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2));
}

async function importDataFile(file) {
  const text = await readFileAsText(file);
  const data = migrateData(safeJsonParse(text));
  validateState(data);
  setState(data, "import");
  showAlert("Datos importados correctamente.");
}

async function importLocalPack(file) {
  const text = await readFileAsText(file);
  const pack = safeJsonParse(text);
  validatePack(pack);
  updateState(draft => mergePackIntoState(draft, pack), "pack-local");
  showAlert(`Pack ${pack.name} importado.`);
}

function shareShoppingText(state) {
  const week = state.weeks.find(w => w.id === state.activeWeekId);
  const text = `Lista de la compra · ${week?.name || "Semana"}\n\n` + computeShoppingListWithProgress(state)
    .filter(i => i.remainingQty > 0)
    .map(i => `- ${i.name}: ${i.display.remaining}`)
    .join("\n");
  if (navigator.share) navigator.share({ text });
  else navigator.clipboard?.writeText(text).then(() => showAlert("Lista copiada al portapapeles."));
}

function newWeek() {
  const name = prompt("Nombre de la nueva semana", "Nueva semana");
  if (!name) return;
  updateState(draft => {
    const week = withMeta({ name: stripDangerousText(name), isTypical: false, plan: {} }, "week");
    draft.weeks.push(week);
    draft.activeWeekId = week.id;
  }, "new-week");
}

function duplicateWeek() {
  updateState(draft => {
    const active = draft.weeks.find(w => w.id === draft.activeWeekId);
    if (!active) return;
    const copy = withMeta({ name: `${active.name} copia`, isTypical: false, plan: JSON.parse(JSON.stringify(active.plan || {})) }, "week");
    draft.weeks.push(copy);
    draft.activeWeekId = copy.id;
  }, "duplicate-week");
  showAlert("Semana duplicada.");
}

function clearWeek() {
  if (!confirm("¿Limpiar la planificación de esta semana?")) return;
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    if (week) week.plan = {};
  }, "clear-week");
  showAlert("Semana limpiada.");
}

function deleteIngredient(id) {
  if (!confirm("¿Eliminar ingrediente?")) return;
  updateState(draft => {
    draft.ingredients = draft.ingredients.filter(i => i.id !== id);
    draft.dishes.forEach(d => { d.recipe = (d.recipe || []).filter(r => r.ingredientId !== id); });
    draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== id);
  }, "ingredient-delete");
}

function deleteDish(id) {
  if (!confirm("¿Eliminar plato?")) return;
  updateState(draft => {
    draft.dishes = draft.dishes.filter(d => d.id !== id);
    draft.weeks.forEach(week => {
      Object.keys(week.plan || {}).forEach(slot => week.plan[slot] = (week.plan[slot] || []).filter(dishId => dishId !== id));
    });
  }, "dish-delete");
}

function removeDishFromSlot(slot, dishId) {
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    if (!week) return;
    week.plan[slot] = (week.plan[slot] || []).filter(id => id !== dishId);
  }, "plan-remove");
}

function setSessionUsdaApiKey(value) {
  const cleaned = String(value || "").trim();
  if (cleaned) sessionStorage.setItem("gestorMenuSemanal.usdaApiKey.session", cleaned);
  else sessionStorage.removeItem("gestorMenuSemanal.usdaApiKey.session");
}

function openEditStockModal() {}
function openInlinePurchaseScanner() {}
async function startPreviewScanner() {}
function openOpenFoodFactsModal() {}
function importOffProduct() {}
async function searchOffIntoModal() {}
function openUsdaModal() {}
async function searchUsdaIntoModal() {}
function importUsdaFood() {}
function openWasteModal() {}
function openRecyclingModal() {}
async function listPacksIntoUi() {}
async function installRemotePack() {}
function saveStockAdjust() {}
function saveWaste() {}
function saveRecycling() {}
