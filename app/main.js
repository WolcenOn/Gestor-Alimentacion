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
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    const copy = withMeta({ name: `${week.name} copia`, isTypical: false, plan: structuredClone(week.plan || {}) }, "week");
    draft.weeks.push(copy);
    draft.activeWeekId = copy.id;
  }, "duplicate-week");
  showAlert("Semana duplicada.");
}

function clearWeek() {
  if (!confirm("¿Limpiar la planificación de esta semana?")) return;
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    week.plan = {};
  }, "clear-week");
}

function removeDishFromSlot(slot, dishId) {
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    week.plan[slot] = (week.plan[slot] || []).filter(id => id !== dishId);
  }, "plan-remove");
}

function deleteIngredient(id) {
  if (!confirm("Eliminar este ingrediente también puede romper recetas que lo usan. ¿Continuar?")) return;
  updateState(draft => { draft.ingredients = draft.ingredients.filter(i => i.id !== id); }, "ingredient-delete");
}

function deleteDish(id) {
  if (!confirm("¿Eliminar este plato?")) return;
  updateState(draft => {
    draft.dishes = draft.dishes.filter(d => d.id !== id);
    draft.weeks.forEach(w => Object.keys(w.plan || {}).forEach(slot => w.plan[slot] = w.plan[slot].filter(dishId => dishId !== id)));
  }, "dish-delete");
}

function openEditStockModal(ingredientId) {
  const state = getState();
  const ingredient = state.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}" ${f.id === ingredient.familyId ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("");
  const unitOption = unit => `<option ${ingredient.unit === unit ? "selected" : ""}>${unit}</option>`;
  const storageOption = (value, label) => `<option value="${value}" ${ingredient.storageType === value ? "selected" : ""}>${label}</option>`;
  const dateOption = (value, label) => `<option value="${value}" ${ingredient.dateType === value ? "selected" : ""}>${label}</option>`;
  const packagingTypes = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];
  const selectedPackaging = ingredient.packagingType || "otro";
  openModal(`
    <header><div><h2>Editar ingrediente y stock</h2><p class="muted">Corrige datos del alimento ya almacenado.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <form data-form="stock-adjust" data-ingredient-id="${escapeHtml(ingredient.id)}">
      <div class="form-grid">
        <label>Nombre<input name="name" value="${escapeHtml(ingredient.name)}" required></label>
        <label>Familia<select name="familyId">${familyOptions}</select></label>
        <label>Cantidad<input name="qty" type="number" step="0.01" min="0" value="${escapeHtml(String(ingredient.qty))}"></label>
        <label>Unidad<select name="unit">${unitOption("g")}${unitOption("kg")}${unitOption("ml")}${unitOption("l")}${unitOption("unidades")}</select></label>
        <label>Conservación<select name="storageType">${storageOption("pantry", "Despensa")}${storageOption("fridge", "Nevera")}${storageOption("freezer", "Congelador")}</select></label>
        <label>Caducidad<input name="expiryDate" type="date" value="${escapeHtml(ingredient.expiryDate || "")}"></label>
        <label>Tipo de fecha<select name="dateType">${dateOption("expiry", "Caducidad")}${dateOption("bestBefore", "Consumo preferente")}${dateOption("none", "Sin fecha")}</select></label>
        <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="${escapeHtml(String(ingredient.approxPrice || 0))}"></label>
        <label>Tipo de envase<select name="packagingType">${packagingTypes.map(type => `<option ${selectedPackaging === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
      </div>
      <label>Notas internas<textarea name="notes" placeholder="Correcciones, equivalencias, observaciones...">${escapeHtml(ingredient.notes || "")}</textarea></label>
      <button>Guardar cambios</button>
    </form>`);
}

function saveStockAdjust(form) {
  const data = formToObject(form);
  updateState(draft => {
    const ingredient = draft.ingredients.find(i => i.id === form.dataset.ingredientId);
    ingredient.name = stripDangerousText(data.name || ingredient.name);
    ingredient.familyId = data.familyId || ingredient.familyId;
    ingredient.qty = parseNumber(data.qty);
    ingredient.unit = normalizeUnit(data.unit);
    ingredient.available = ingredient.qty > 0;
    ingredient.storageType = data.storageType || ingredient.storageType;
    ingredient.expiryDate = data.expiryDate || "";
    ingredient.dateType = data.dateType || "none";
    ingredient.approxPrice = parseNumber(data.approxPrice);
    ingredient.packagingType = data.packagingType || "otro";
    ingredient.notes = stripDangerousText(data.notes || "");
    ingredient.updatedAt = new Date().toISOString();
  }, "stock-adjust");
  closeModal();
  showAlert("Stock ajustado.");
}

let remotePackFiles = [];
async function listPacksIntoUi() {
  const root = document.getElementById("remotePackList");
  root.innerHTML = `<p class="muted">Buscando packs...</p>`;
  remotePackFiles = await listRemotePacks();
  root.innerHTML = remotePackFiles.length
    ? remotePackFiles.map((f, index) => `<div class="item"><strong>${escapeHtml(f.name)}</strong><p class="qty-line">${escapeHtml(f.path)}</p><button data-action="install-remote-pack" data-index="${index}">Previsualizar e instalar</button></div>`).join("")
    : `<p class="muted">No se encontraron packs.</p>`;
}

async function installRemotePack(index) {
  const file = remotePackFiles[Number(index)];
  if (!file) throw new Error("Pack no encontrado.");
  const pack = await loadRemotePack(file);
  const ok = confirm(`Pack: ${pack.name}\nIngredientes: ${pack.ingredients.length}\nPlatos: ${pack.dishes.length}\n\n¿Importar?`);
  if (!ok) return;
  updateState(draft => mergePackIntoState(draft, pack), "pack-remote");
  showAlert(`Pack ${pack.name} instalado.`);
}

window.__gestorMenuDebug = { getState, resetDemoData };

let offResults = [];
let usdaResults = [];
const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";

function getSessionUsdaApiKey() {
  return sessionStorage.getItem(USDA_SESSION_KEY) || "";
}

function setSessionUsdaApiKey(value) {
  const cleaned = String(value || "").trim();
  if (cleaned) sessionStorage.setItem(USDA_SESSION_KEY, cleaned);
  else sessionStorage.removeItem(USDA_SESSION_KEY);
}

function getUsdaApiKeyForSearch(fieldValue = "") {
  return String(fieldValue || getSessionUsdaApiKey() || "DEMO_KEY").trim();
}

async function startPreviewScanner() {
  const box = document.querySelector(".scanner-box");
  const video = document.getElementById("barcodeVideo");
  const status = document.getElementById("scannerStatus");
  if (!box || !video) return;
  const barcode = await scanBarcodeWithPreview(video, status);
  if (status) status.textContent = `Código detectado: ${barcode}`;

  if (box.dataset.scannerTarget === "purchase") {
    const form = document.querySelector('form[data-form="purchase"]');
    if (!form) return;
    form.elements.barcode.value = barcode;
    const product = await lookupOpenFoodFacts(barcode);
    fillPurchaseFormFromProduct(form, product);
    showAlert(product ? "Producto encontrado y formulario rellenado." : "Código detectado. No se encontró en Open Food Facts.");
    box.remove();
    return;
  }

  if (box.dataset.scannerTarget === "ingredient") {
    const product = await lookupOpenFoodFacts(barcode);
    if (!product) throw new Error("Código detectado, pero no encontrado en Open Food Facts.");
    offResults = [product];
    importOffProduct(0, box.dataset.ingredientId);
    closeModal();
  }
}

function fillPurchaseFormFromProduct(form, product) {
  if (!product) return;
  form.elements.brand.value = product.brand || "";
  form.elements.productName.value = product.productName || "";
  if (product.packageQty) form.elements.purchasedQty.value = product.packageQty;
  if (product.packageUnit) form.elements.unit.value = normalizeUnit(product.packageUnit);
  if (form.elements.packagingType) form.elements.packagingType.value = normalizePackagingType(product.packaging || "");
}

function openInlinePurchaseScanner() {
  const form = document.querySelector('form[data-form="purchase"]');
  if (!form) return;
  if (document.querySelector(".scanner-box")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderBarcodeScannerModal({ title: "Escanear compra", target: "purchase" });
  const box = wrapper.querySelector(".scanner-box");
  form.prepend(box);
}

function openOpenFoodFactsModal(ingredientId = "") {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  openModal(`
    <header>
      <div><h2>Buscar en Open Food Facts</h2><p class="muted">${ingredient ? `Asociar producto a ${escapeHtml(ingredient.name)}` : "Importar alimento como nuevo ingrediente"}</p></div>
      <button class="secondary" data-action="close-modal">×</button>
    </header>
    <div class="search-panel" data-ingredient-id="${escapeHtml(ingredientId)}">
      <label>Alimento o marca<input id="offSearchQuery" placeholder="Ej. yogur natural, atún, tomate"></label>
      <div class="actions"><button type="button" data-action="search-off-products">Buscar</button></div>
      <div id="offSearchResults" class="list results-list"><p class="muted">Busca un producto para importarlo.</p></div>
    </div>
  `);
}

async function searchOffIntoModal() {
  const q = document.getElementById("offSearchQuery")?.value || "";
  const root = document.getElementById("offSearchResults");
  const ingredientId = document.querySelector(".search-panel")?.dataset.ingredientId || "";
  root.innerHTML = `<p class="muted">Buscando...</p>`;
  offResults = await searchOpenFoodFacts(q);
  root.innerHTML = offResults.length ? offResults.map((p, index) => renderOffResult(p, index, ingredientId)).join("") : `<p class="muted">No se han encontrado productos.</p>`;
}

function renderOffResult(product, index, ingredientId) {
  return `
    <div class="item product-result">
      ${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy">` : ""}
      <div class="result-body">
        <strong>${escapeHtml(product.productName)}</strong>
        <p class="qty-line">${escapeHtml(product.brand || "Sin marca")} · ${escapeHtml(product.quantity || "sin cantidad")} · ${escapeHtml(product.barcode)}</p>
        <p class="small muted">Nutri-Score: ${escapeHtml(product.nutriscore || "n/d")} · Envase: ${escapeHtml(product.packaging || "n/d")}</p>
        <button data-action="import-off-product" data-index="${index}" data-ingredient-id="${escapeHtml(ingredientId)}">${ingredientId ? "Asociar a ingrediente" : "Crear ingrediente"}</button>
      </div>
    </div>`;
}

function importOffProduct(index, ingredientId = "") {
  const product = offResults[index];
  if (!product) throw new Error("Producto no encontrado.");
  updateState(draft => {
    let ingredient = ingredientId ? draft.ingredients.find(i => i.id === ingredientId) : null;
    if (!ingredient) {
      ingredient = withMeta({
        name: stripDangerousText(product.productName),
        familyId: draft.ingredientFamilies[0]?.id || "family_other",
        qty: 0,
        unit: normalizeUnit(product.packageUnit || "g"),
        available: false,
        storageType: "pantry",
        expiryDate: "",
        dateType: "none",
        approxPrice: 0,
        packagingType: normalizePackagingType(product.packaging || ""),
        products: []
      }, "ingredient");
      draft.ingredients.push(ingredient);
    }
    ingredient.products ||= [];
    if (!ingredient.products.some(p => p.barcode === product.barcode)) {
      ingredient.products.push({
        barcode: product.barcode,
        brand: stripDangerousText(product.brand || ""),
        productName: stripDangerousText(product.productName || ingredient.name),
        packageQty: Number(product.packageQty) || 0,
        packageUnit: normalizeUnit(product.packageUnit || ingredient.unit),
        price: 0,
        source: "openfoodfacts",
        packaging: stripDangerousText(product.packaging || ""),
        packagingType: normalizePackagingType(product.packaging || ""),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    const nutrition = nutritionProfileFromOpenFoodFacts(product, ingredient.id);
    if ([nutrition.kcal, nutrition.carbs, nutrition.protein, nutrition.fat].some(Boolean)) {
      draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== ingredient.id || n.source !== "openfoodfacts");
      draft.nutritionProfiles.push(withMeta(nutrition, "nutrition"));
    }
  }, "off-import");
  showAlert(ingredientId ? "Producto asociado al ingrediente." : "Ingrediente creado desde Open Food Facts.");
  closeModal();
}

function openUsdaModal(ingredientId = "") {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  openModal(`
    <header>
      <div><h2>Buscar en USDA FoodData Central</h2><p class="muted">${ingredient ? `Guardar nutrición para ${escapeHtml(ingredient.name)}` : "Crear ingrediente con perfil nutricional"}. Usa la key guardada en Ajustes o DEMO_KEY para pruebas.</p></div>
      <button class="secondary" data-action="close-modal">×</button>
    </header>
    <div class="search-panel" data-ingredient-id="${escapeHtml(ingredientId)}">
      <div class="form-grid">
        <label>API key USDA<input id="usdaApiKey" type="password" autocomplete="off" value="${escapeHtml(getSessionUsdaApiKey())}" placeholder="Vacío = DEMO_KEY"></label>
        <label>Alimento<input id="usdaSearchQuery" value="${escapeHtml(ingredient?.name || "")}" placeholder="Ej. tomato, egg, tuna"></label>
      </div>
      <div class="actions"><button type="button" data-action="search-usda-foods">Buscar nutrición</button></div>
      <div id="usdaSearchResults" class="list results-list"><p class="muted">Busca un alimento para importar nutrientes por 100 g/ml.</p></div>
    </div>
  `);
}

async function searchUsdaIntoModal() {
  const query = document.getElementById("usdaSearchQuery")?.value || "";
  const apiKey = getUsdaApiKeyForSearch(document.getElementById("usdaApiKey")?.value || "");
  const root = document.getElementById("usdaSearchResults");
  const ingredientId = document.querySelector(".search-panel")?.dataset.ingredientId || "";
  root.innerHTML = `<p class="muted">Buscando...</p>`;
  const data = await searchUsdaFoodData({ query, apiKey });
  usdaResults = data.foods || [];
  root.innerHTML = usdaResults.length ? usdaResults.map((food, index) => renderUsdaResult(food, index, ingredientId)).join("") : `<p class="muted">No se encontraron alimentos.</p>`;
}

function renderUsdaResult(food, index, ingredientId) {
  const kcal = (food.foodNutrients || []).find(n => String(n.nutrientName || "").toLowerCase().includes("energy"))?.value;
  return `
    <div class="item">
      <strong>${escapeHtml(food.description || "Alimento")}</strong>
      <p class="qty-line">FDC ${escapeHtml(String(food.fdcId || ""))} · ${escapeHtml(food.dataType || "")} · kcal: ${escapeHtml(String(kcal ?? "n/d"))}</p>
      <button data-action="import-usda-food" data-index="${index}" data-ingredient-id="${escapeHtml(ingredientId)}">${ingredientId ? "Guardar nutrición" : "Crear ingrediente"}</button>
    </div>`;
}

function importUsdaFood(index, ingredientId = "") {
  const food = usdaResults[index];
  if (!food) throw new Error("Resultado USDA no encontrado.");
  updateState(draft => {
    let ingredient = ingredientId ? draft.ingredients.find(i => i.id === ingredientId) : null;
    if (!ingredient) {
      ingredient = withMeta({
        name: stripDangerousText(food.description || "Alimento USDA"),
        familyId: draft.ingredientFamilies[0]?.id || "family_other",
        qty: 0,
        unit: "g",
        available: false,
        storageType: "pantry",
        expiryDate: "",
        dateType: "none",
        approxPrice: 0,
        packagingType: normalizePackagingType(product.packaging || ""),
        packagingType: "otro",
        products: []
      }, "ingredient");
      draft.ingredients.push(ingredient);
    }
    const profile = nutritionProfileFromUsdaFood(food, ingredient.id);
    draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== ingredient.id || n.source !== "usda-fooddata-central");
    draft.nutritionProfiles.push(withMeta(profile, "nutrition"));
  }, "usda-import");
  closeModal();
  showAlert("Perfil nutricional importado desde USDA.");
}

function openWasteModal(ingredientId) {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;
  openModal(`
    <header><div><h2>Registrar desperdicio</h2><p class="muted">${escapeHtml(ingredient.name)} · stock actual: ${escapeHtml(String(ingredient.qty))} ${escapeHtml(ingredient.unit)}</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <form data-form="waste" data-ingredient-id="${escapeHtml(ingredient.id)}">
      <div class="form-grid">
        <label>Cantidad tirada<input name="qty" type="number" min="0.01" step="0.01" value="1" required></label>
        <label>Unidad<select name="unit"><option ${ingredient.unit === "g" ? "selected" : ""}>g</option><option ${ingredient.unit === "kg" ? "selected" : ""}>kg</option><option ${ingredient.unit === "ml" ? "selected" : ""}>ml</option><option ${ingredient.unit === "l" ? "selected" : ""}>l</option><option ${ingredient.unit === "unidades" ? "selected" : ""}>unidades</option></select></label>
        <label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>Valor estimado €<input name="estimatedValue" type="number" min="0" step="0.01" placeholder="opcional"></label>
      </div>
      <label>Motivo<textarea name="reason" placeholder="Caducado, mal estado, sobras..."></textarea></label>
      <button>Guardar desperdicio</button>
    </form>`);
}

function saveWaste(form) {
  const data = formToObject(form);
  updateState(draft => registerWaste(draft, {
    ingredientId: form.dataset.ingredientId,
    qty: parseNumber(data.qty),
    unit: normalizeUnit(data.unit),
    date: data.date,
    estimatedValue: parseNumber(data.estimatedValue),
    reason: stripDangerousText(data.reason || "")
  }), "waste");
  closeModal();
  showAlert("Desperdicio registrado y stock actualizado.");
}

function openRecyclingModal() {
  openModal(`
    <header><div><h2>Registrar reciclaje</h2><p class="muted">Añade envases pendientes o reciclados por tipo.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <form data-form="recycling">
      <div class="form-grid">
        <label>Tipo de envase<select name="packagingType"><option>plástico</option><option>cartón/papel</option><option>vidrio</option><option>metal</option><option>brik</option><option>orgánico</option><option>otro</option></select></label>
        <label>Nº de envases<input name="packagingQty" type="number" min="1" step="1" value="1"></label>
        <label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      </div>
      <label>Notas<textarea name="notes"></textarea></label>
      <button>Guardar envases</button>
    </form>`);
}

function saveRecycling(form) {
  const data = formToObject(form);
  updateState(draft => registerRecycling(draft, {
    packagingType: data.packagingType,
    packagingQty: parseNumber(data.packagingQty),
    date: data.date,
    notes: stripDangerousText(data.notes || ""),
    source: "manual"
  }), "recycling");
  closeModal();
  showAlert("Envases registrados.");
}
