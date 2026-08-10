import { getState, updateState, resetDemoData } from "./store.js";
import { withMeta } from "./models.js";
import { escapeHtml, stripDangerousText, parseNumber, normalizeUnit } from "./utils.js";
import { openModal, closeModal, renderBarcodeScannerModal, formToObject, showAlert, getSubmitterValue } from "./render/ui.js";
import { renderPackPreview } from "./render/packs.js";
import { scanBarcodeWithPreview } from "./services/barcodeScanner.js";
import { lookupOpenFoodFacts, searchOpenFoodFacts, nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { listRemotePacks, loadRemotePack, mergePackIntoState, normalizePack, buildPackPrompt } from "./services/packLoader.js";
import { registerWaste, registerRecycling, normalizePackagingType } from "./state/wasteRecycling.js";

let remotePackFiles = [];
let previewedPack = null;
let offResults = [];
let usdaResults = [];
const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";

export function newWeek() {
  const name = prompt("Nombre de la nueva semana", "Nueva semana");
  if (!name) return;
  updateState(draft => {
    const week = withMeta({ name: stripDangerousText(name), isTypical: false, plan: {} }, "week");
    draft.weeks.push(week);
    draft.activeWeekId = week.id;
  }, "new-week");
}

export function duplicateWeek() {
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    const copy = withMeta({ name: `${week.name} copia`, isTypical: false, plan: structuredClone(week.plan || {}) }, "week");
    draft.weeks.push(copy);
    draft.activeWeekId = copy.id;
  }, "duplicate-week");
  showAlert("Semana duplicada.");
}

export function clearWeek() {
  if (!confirm("¿Limpiar la planificación de esta semana?")) return;
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    week.plan = {};
  }, "clear-week");
}

export function removeDishFromSlot(slot, dishId) {
  updateState(draft => {
    const week = draft.weeks.find(w => w.id === draft.activeWeekId);
    week.plan[slot] = (week.plan[slot] || []).filter(id => id !== dishId);
  }, "plan-remove");
}

export function deleteIngredient(id) {
  if (!confirm("Eliminar este ingrediente también puede romper recetas que lo usan. ¿Continuar?")) return;
  updateState(draft => {
    draft.ingredients = draft.ingredients.filter(i => i.id !== id);
    draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== id);
  }, "ingredient-delete");
}

export function deleteDish(id) {
  if (!confirm("¿Eliminar este plato?")) return;
  updateState(draft => {
    draft.dishes = draft.dishes.filter(d => d.id !== id);
    draft.weeks.forEach(w => Object.keys(w.plan || {}).forEach(slot => w.plan[slot] = w.plan[slot].filter(dishId => dishId !== id)));
  }, "dish-delete");
}

export function openEditStockModal(ingredientId) {
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

export function saveStockAdjust(form) {
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

export async function listPacksIntoUi() {
  const root = document.getElementById("remotePackList");
  root.innerHTML = `<p class="muted">Buscando packs...</p>`;
  remotePackFiles = await listRemotePacks();
  root.innerHTML = remotePackFiles.length
    ? remotePackFiles.map((f, index) => `<div class="item pack-file-item" data-search="${escapeHtml([f.name, f.path].join(" "))}"><strong>${escapeHtml(f.name)}</strong><p class="qty-line">${escapeHtml(f.path)}</p><button data-action="preview-remote-pack" data-index="${index}">Previsualizar</button></div>`).join("")
    : `<p class="muted">No se encontraron packs.</p>`;
}

export async function previewRemotePack(index) {
  const file = remotePackFiles[Number(index)];
  if (!file) throw new Error("Pack no encontrado.");
  previewedPack = normalizePack(await loadRemotePack(file), file.path);
  openModal(renderPackPreview(previewedPack, "remote"));
}

export function installPreviewedPack(form, event) {
  const mode = getSubmitterValue(event, "installMode") || "merge";
  if (!previewedPack) throw new Error("No hay pack previsualizado.");
  updateState(draft => mergePackIntoState(draft, previewedPack, { mode }), "pack-install");
  closeModal();
  showAlert(`Pack ${previewedPack.name} instalado.`);
  previewedPack = null;
}

export function generatePackPrompt(form) {
  const data = formToObject(form);
  const prompt = buildPackPrompt({
    theme: data.theme,
    days: parseNumber(data.days, 7),
    servings: parseNumber(data.servings, 4),
    dietaryNotes: data.dietaryNotes,
    budget: data.budget,
    includeNutrition: Boolean(data.includeNutrition)
  });
  const output = document.getElementById("packPromptOutput");
  if (output) output.value = prompt;
}

export async function copyPackPrompt() {
  const output = document.getElementById("packPromptOutput");
  if (!output?.value) throw new Error("Genera primero un prompt.");
  await navigator.clipboard?.writeText(output.value);
  showAlert("Prompt copiado al portapapeles.");
}

export async function startPreviewScanner() {
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

export function openInlinePurchaseScanner() {
  const form = document.querySelector('form[data-form="purchase"]');
  if (!form) return;
  if (document.querySelector(".scanner-box")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderBarcodeScannerModal({ title: "Escanear compra", target: "purchase" });
  const box = wrapper.querySelector(".scanner-box");
  form.prepend(box);
}

export function openOpenFoodFactsModal(ingredientId = "") {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  openModal(`
    <header><div><h2>Buscar en Open Food Facts</h2><p class="muted">${ingredient ? `Asociar producto a ${escapeHtml(ingredient.name)}` : "Importar alimento como nuevo ingrediente"}</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <div class="search-panel" data-ingredient-id="${escapeHtml(ingredientId)}">
      <label>Alimento o marca<input id="offSearchQuery" placeholder="Ej. yogur natural, atún, tomate"></label>
      <div class="actions"><button type="button" data-action="search-off-products">Buscar</button></div>
      <div id="offSearchResults" class="list results-list"><p class="muted">Busca un producto para importarlo.</p></div>
    </div>`);
}

export async function searchOffIntoModal() {
  const q = document.getElementById("offSearchQuery")?.value || "";
  const root = document.getElementById("offSearchResults");
  const ingredientId = document.querySelector(".search-panel")?.dataset.ingredientId || "";
  root.innerHTML = `<p class="muted">Buscando...</p>`;
  offResults = await searchOpenFoodFacts(q);
  root.innerHTML = offResults.length ? offResults.map((p, index) => renderOffResult(p, index, ingredientId)).join("") : `<p class="muted">No se han encontrado productos.</p>`;
}

function renderOffResult(product, index, ingredientId) {
  return `<div class="item product-result">${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy">` : ""}<div class="result-body"><strong>${escapeHtml(product.productName)}</strong><p class="qty-line">${escapeHtml(product.brand || "Sin marca")} · ${escapeHtml(product.quantity || "sin cantidad")} · ${escapeHtml(product.barcode)}</p><p class="small muted">Nutri-Score: ${escapeHtml(product.nutriscore || "n/d")} · Envase: ${escapeHtml(product.packaging || "n/d")}</p><button data-action="import-off-product" data-index="${index}" data-ingredient-id="${escapeHtml(ingredientId)}">${ingredientId ? "Asociar a ingrediente" : "Crear ingrediente"}</button></div></div>`;
}

export function importOffProduct(index, ingredientId = "") {
  const product = offResults[index];
  if (!product) throw new Error("Producto no encontrado.");
  updateState(draft => {
    let ingredient = ingredientId ? draft.ingredients.find(i => i.id === ingredientId) : null;
    const packageQty = Number(product.packageQty) || 0;
    const packageUnit = normalizeUnit(product.packageUnit || "g");
    if (!ingredient) {
      ingredient = withMeta({
        name: stripDangerousText(product.productName),
        familyId: draft.ingredientFamilies[0]?.id || "family_other",
        qty: packageQty,
        unit: packageUnit,
        available: packageQty > 0,
        storageType: "pantry",
        expiryDate: "",
        dateType: "none",
        approxPrice: 0,
        packagingType: normalizePackagingType(product.packaging || product.packagingType || ""),
        products: []
      }, "ingredient");
      draft.ingredients.push(ingredient);
    }
    ingredient.products ||= [];
    if (!ingredient.products.some(p => p.barcode === product.barcode)) {
      ingredient.products.push({ barcode: product.barcode, brand: stripDangerousText(product.brand || ""), productName: stripDangerousText(product.productName || ingredient.name), packageQty, packageUnit, price: 0, source: "openfoodfacts", packaging: stripDangerousText(product.packaging || ""), packagingType: normalizePackagingType(product.packaging || product.packagingType || ""), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    const nutrition = nutritionProfileFromOpenFoodFacts(product, ingredient.id);
    if ([nutrition.kcal, nutrition.carbs, nutrition.protein, nutrition.fat].some(Boolean)) {
      draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== ingredient.id || n.source !== "openfoodfacts");
      draft.nutritionProfiles.push(withMeta(nutrition, "nutrition"));
    }
  }, "off-import");
  showAlert(ingredientId ? "Producto asociado al ingrediente." : "Ingrediente creado desde Open Food Facts y añadido al stock.");
  closeModal();
}

function getSessionUsdaApiKey() { return sessionStorage.getItem(USDA_SESSION_KEY) || ""; }
function getUsdaApiKeyForSearch(fieldValue = "") { return String(fieldValue || getSessionUsdaApiKey() || "DEMO_KEY").trim(); }

export function openUsdaModal(ingredientId = "") {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  openModal(`<header><div><h2>Buscar en USDA FoodData Central</h2><p class="muted">${ingredient ? `Guardar nutrición para ${escapeHtml(ingredient.name)}` : "Crear ingrediente con perfil nutricional"}. Usa la key guardada en Ajustes o DEMO_KEY para pruebas.</p></div><button class="secondary" data-action="close-modal">×</button></header><div class="search-panel" data-ingredient-id="${escapeHtml(ingredientId)}"><div class="form-grid"><label>API key USDA<input id="usdaApiKey" type="password" autocomplete="off" value="${escapeHtml(getSessionUsdaApiKey())}" placeholder="Vacío = DEMO_KEY"></label><label>Alimento<input id="usdaSearchQuery" value="${escapeHtml(ingredient?.name || "")}" placeholder="Ej. tomato, egg, tuna"></label></div><div class="actions"><button type="button" data-action="search-usda-foods">Buscar nutrición</button></div><div id="usdaSearchResults" class="list results-list"><p class="muted">Busca un alimento para importar nutrientes por 100 g/ml.</p></div></div>`);
}

export async function searchUsdaIntoModal() {
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
  return `<div class="item"><strong>${escapeHtml(food.description || "Alimento")}</strong><p class="qty-line">FDC ${escapeHtml(String(food.fdcId || ""))} · ${escapeHtml(food.dataType || "")} · kcal: ${escapeHtml(String(kcal ?? "n/d"))}</p><button data-action="import-usda-food" data-index="${index}" data-ingredient-id="${escapeHtml(ingredientId)}">${ingredientId ? "Guardar nutrición" : "Crear ingrediente"}</button></div>`;
}

export function importUsdaFood(index, ingredientId = "") {
  const food = usdaResults[index];
  if (!food) throw new Error("Resultado USDA no encontrado.");
  updateState(draft => {
    let ingredient = ingredientId ? draft.ingredients.find(i => i.id === ingredientId) : null;
    if (!ingredient) {
      ingredient = withMeta({ name: stripDangerousText(food.description || "Alimento USDA"), familyId: draft.ingredientFamilies[0]?.id || "family_other", qty: 0, unit: "g", available: false, storageType: "pantry", expiryDate: "", dateType: "none", approxPrice: 0, packagingType: "otro", products: [] }, "ingredient");
      draft.ingredients.push(ingredient);
    }
    const profile = nutritionProfileFromUsdaFood(food, ingredient.id);
    draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== ingredient.id || n.source !== "usda-fooddata-central");
    draft.nutritionProfiles.push(withMeta(profile, "nutrition"));
  }, "usda-import");
  closeModal();
  showAlert("Perfil nutricional importado desde USDA.");
}

export function openWasteModal(ingredientId) {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;
  openModal(`<header><div><h2>Registrar desperdicio</h2><p class="muted">${escapeHtml(ingredient.name)} · stock actual: ${escapeHtml(String(ingredient.qty))} ${escapeHtml(ingredient.unit)}</p></div><button class="secondary" data-action="close-modal">×</button></header><form data-form="waste" data-ingredient-id="${escapeHtml(ingredient.id)}"><div class="form-grid"><label>Cantidad tirada<input name="qty" type="number" min="0.01" step="0.01" value="1" required></label><label>Unidad<select name="unit"><option ${ingredient.unit === "g" ? "selected" : ""}>g</option><option ${ingredient.unit === "kg" ? "selected" : ""}>kg</option><option ${ingredient.unit === "ml" ? "selected" : ""}>ml</option><option ${ingredient.unit === "l" ? "selected" : ""}>l</option><option ${ingredient.unit === "unidades" ? "selected" : ""}>unidades</option></select></label><label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label>Valor estimado €<input name="estimatedValue" type="number" min="0" step="0.01" placeholder="opcional"></label></div><label>Motivo<textarea name="reason" placeholder="Caducado, mal estado, sobras..."></textarea></label><button>Guardar desperdicio</button></form>`);
}

export function saveWaste(form) {
  const data = formToObject(form);
  updateState(draft => registerWaste(draft, { ingredientId: form.dataset.ingredientId, qty: parseNumber(data.qty), unit: normalizeUnit(data.unit), date: data.date, estimatedValue: parseNumber(data.estimatedValue), reason: stripDangerousText(data.reason || "") }), "waste");
  closeModal();
  showAlert("Desperdicio registrado y stock actualizado.");
}

export function openRecyclingModal() {
  openModal(`<header><div><h2>Registrar reciclaje</h2><p class="muted">Añade envases pendientes o reciclados por tipo.</p></div><button class="secondary" data-action="close-modal">×</button></header><form data-form="recycling"><div class="form-grid"><label>Tipo de envase<select name="packagingType"><option>plástico</option><option>cartón/papel</option><option>vidrio</option><option>metal</option><option>brik</option><option>orgánico</option><option>otro</option></select></label><label>Nº de envases<input name="packagingQty" type="number" min="1" step="1" value="1"></label><label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div><label>Notas<textarea name="notes"></textarea></label><button>Guardar envases</button></form>`);
}

export function saveRecycling(form) {
  const data = formToObject(form);
  updateState(draft => registerRecycling(draft, { packagingType: data.packagingType, packagingQty: parseNumber(data.packagingQty), date: data.date, notes: stripDangerousText(data.notes || ""), source: "manual" }), "recycling");
  closeModal();
  showAlert("Envases registrados.");
}

window.__gestorMenuDebug = { getState, resetDemoData };
