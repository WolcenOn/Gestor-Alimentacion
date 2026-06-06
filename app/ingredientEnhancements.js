import { getState, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { escapeHtml, stripDangerousText, parseNumber, normalizeUnit } from "./utils.js";
import { showAlert, openModal, closeModal, formToObject } from "./render/ui.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { lookupOpenFoodFacts, searchOpenFoodFacts, nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { scanBarcodeWithPreview } from "./services/barcodeScanner.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
const OFF_LANG_KEY = "gestorMenuSemanal.openFoodFacts.lang";
const PACKAGING_TYPES = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];
const LANGUAGES = [
  ["es", "Español"],
  ["en", "Inglés"],
  ["fr", "Francés"],
  ["ca", "Catalán"],
  ["pt", "Portugués"],
  ["it", "Italiano"],
  ["de", "Alemán"]
];

let usdaResults = [];
let offResults = [];

function getSessionUsdaApiKey() {
  return sessionStorage.getItem(USDA_SESSION_KEY) || "";
}

function setSessionUsdaApiKey(value) {
  const cleaned = String(value || "").trim();
  if (cleaned) sessionStorage.setItem(USDA_SESSION_KEY, cleaned);
  else sessionStorage.removeItem(USDA_SESSION_KEY);
}

function getOffLang() {
  return localStorage.getItem(OFF_LANG_KEY) || "es";
}

function setOffLang(value) {
  localStorage.setItem(OFF_LANG_KEY, String(value || "es"));
}

function getUsdaApiKeyForSearch(fieldValue = "") {
  return String(fieldValue || getSessionUsdaApiKey() || "DEMO_KEY").trim();
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  try {
    if (action === "scan-new-ingredient") {
      stop(event);
      openScanIngredientModal();
      await startIngredientScan();
    }

    if (action === "retry-ingredient-scan") {
      stop(event);
      await startIngredientScan();
    }

    if (action === "edit-ingredient-stock" || action === "edit-stock") {
      stop(event);
      openEditIngredientStockModal(button.dataset.ingredientId);
    }

    if (action === "add-barcode-to-ingredient") {
      stop(event);
      openAddBarcodeModal(button.dataset.ingredientId);
    }

    if (action === "scan-existing-ingredient-barcode") {
      stop(event);
      openScanExistingIngredientModal(button.dataset.ingredientId);
      await startExistingIngredientScan(button.dataset.ingredientId);
    }

    if (action === "open-off-search") {
      stop(event);
      openOpenFoodFactsModal(button.dataset.ingredientId || "");
    }

    if (action === "search-off-products") {
      stop(event);
      await searchOffIntoModal();
    }

    if (action === "import-off-product") {
      stop(event);
      importOffProduct(Number(button.dataset.index), button.dataset.ingredientId || "");
    }

    if (action === "open-usda-search") {
      stop(event);
      openUsdaModal(button.dataset.ingredientId || "");
    }

    if (action === "search-usda-foods") {
      stop(event);
      await searchUsdaIntoModal();
    }

    if (action === "import-usda-food") {
      stop(event);
      importUsdaFood(Number(button.dataset.index), button.dataset.ingredientId || "");
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "Ha ocurrido un error.", "error");
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest("form");
  if (!form) return;

  try {
    if (form.dataset.form === "ingredient" || form.dataset.form === "ingredient-enhanced") {
      stop(event);
      addIngredientEnhanced(form);
    }

    if (form.dataset.form === "stock-adjust-enhanced") {
      stop(event);
      saveStockAdjustEnhanced(form);
    }

    if (form.dataset.form === "usda-settings") {
      stop(event);
      saveUsdaSettings(form);
    }

    if (form.dataset.form === "barcode-product") {
      stop(event);
      saveBarcodeProduct(form);
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "Ha ocurrido un error.", "error");
  }
}, true);

function addIngredientEnhanced(form) {
  const data = formToObject(form);
  const product = productFromFormData(data);
  updateState(draft => {
    const ingredient = withMeta({
      name: stripDangerousText(data.name || data.productName || "Ingrediente"),
      familyId: data.familyId,
      qty: parseNumber(data.qty || product.packageQty || 0),
      unit: normalizeUnit(data.unit || product.packageUnit || "g"),
      available: parseNumber(data.qty || 0) > 0,
      storageType: data.storageType || "pantry",
      expiryDate: data.expiryDate || "",
      dateType: data.dateType || "none",
      approxPrice: parseNumber(data.approxPrice),
      packagingType: normalizePackagingType(data.packagingType || product.packagingType || "otro"),
      notes: stripDangerousText(data.notes || product.ingredientsText || ""),
      products: []
    }, "ingredient");

    if (product.barcode || product.productName || product.brand) ingredient.products.push(product);
    draft.ingredients.push(ingredient);

    if (data.nutritionSource === "openfoodfacts" && product.barcode) {
      draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== ingredient.id || n.source !== "openfoodfacts");
      draft.nutritionProfiles.push(withMeta(nutritionProfileFromOpenFoodFacts(product, ingredient.id), "nutrition"));
    }
  }, "ingredient-add-enhanced");
  closeModal();
  form.reset?.();
  showAlert("Ingrediente guardado con ficha completa.");
}

function productFromFormData(data) {
  return {
    barcode: stripDangerousText(data.barcode || ""),
    brand: stripDangerousText(data.brand || ""),
    productName: stripDangerousText(data.productName || data.name || ""),
    genericName: stripDangerousText(data.genericName || ""),
    packageQty: parseNumber(data.packageQty || data.qty),
    packageUnit: normalizeUnit(data.packageUnit || data.unit || "g"),
    servingQty: parseNumber(data.servingQty),
    servingUnit: normalizeUnit(data.servingUnit || "g"),
    price: parseNumber(data.approxPrice),
    source: data.productSource || "manual",
    lang: data.lang || getOffLang(),
    packagingType: normalizePackagingType(data.packagingType || "otro"),
    packaging: stripDangerousText(data.packaging || ""),
    categories: stripDangerousText(data.categories || ""),
    labels: stripDangerousText(data.labels || ""),
    allergens: stripDangerousText(data.allergens || ""),
    ingredientsText: stripDangerousText(data.ingredientsText || ""),
    nutriscore: stripDangerousText(data.nutriscore || ""),
    ecoscore: stripDangerousText(data.ecoscore || ""),
    novaGroup: stripDangerousText(data.novaGroup || ""),
    imageUrl: stripDangerousText(data.imageUrl || ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function openScanIngredientModal() {
  openModal(`
    <header>
      <div><h2>Escanear alimento</h2><p class="muted">La cámara se activará automáticamente. Cuando detecte el código, se rellenará una ficha temporal editable antes de guardar.</p></div>
      <button class="secondary" data-action="close-modal">×</button>
    </header>
    <div class="scanner-box">
      <video id="ingredientScanVideo" class="scanner-video" autoplay muted playsinline></video>
      <div class="scanner-frame"></div>
      <p id="ingredientScanStatus" class="muted">Activando cámara...</p>
    </div>
    <div class="actions">
      <button type="button" class="secondary" data-action="retry-ingredient-scan">Reintentar escaneo</button>
    </div>
    <form data-form="ingredient" class="ingredient-draft-form">
      ${renderIngredientDraftFields({})}
      <button>Guardar ingrediente</button>
    </form>
  `);
}

async function startIngredientScan() {
  const video = document.getElementById("ingredientScanVideo");
  const status = document.getElementById("ingredientScanStatus");
  if (!video || !status) return;
  status.textContent = "Cámara activa. Apunta al código de barras.";
  const barcode = await scanBarcodeWithPreview(video, status);
  status.textContent = `Código detectado: ${barcode}. Buscando datos...`;
  const product = await lookupOpenFoodFacts(barcode, { lang: getOffLang() });
  if (product) {
    fillIngredientDraftForm(productToDraft(product));
    status.textContent = "Producto encontrado. Revisa la ficha, añade caducidad o datos faltantes y guarda.";
    showAlert("Ficha temporal rellenada desde Open Food Facts.");
  } else {
    fillIngredientDraftForm({ barcode, productSource: "manual", lang: getOffLang() });
    status.textContent = "Código detectado, pero sin datos en Open Food Facts. Completa la ficha manualmente.";
  }
}

function productToDraft(product) {
  return {
    name: product.genericName || product.productName,
    productName: product.productName,
    genericName: product.genericName,
    barcode: product.barcode,
    brand: product.brand,
    qty: product.packageQty || 0,
    unit: product.packageUnit || "g",
    packageQty: product.packageQty || 0,
    packageUnit: product.packageUnit || "g",
    servingQty: product.servingQty || 0,
    servingUnit: product.servingUnit || "g",
    packagingType: product.packagingType || "otro",
    packaging: product.packagingText || product.packaging || "",
    categories: product.categories || "",
    labels: product.labels || "",
    allergens: product.allergens || "",
    ingredientsText: product.ingredientsText || "",
    nutriscore: product.nutriscore || "",
    ecoscore: product.ecoscore || "",
    novaGroup: product.novaGroup || "",
    imageUrl: product.imageUrl || "",
    productSource: "openfoodfacts",
    nutritionSource: "openfoodfacts",
    lang: product.lang || getOffLang()
  };
}

function renderIngredientDraftFields(values = {}) {
  const state = getState();
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}" ${values.familyId === f.id ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("");
  return `
    <input type="hidden" name="productSource" value="${escapeHtml(values.productSource || "manual")}">
    <input type="hidden" name="nutritionSource" value="${escapeHtml(values.nutritionSource || "")}">
    <input type="hidden" name="imageUrl" value="${escapeHtml(values.imageUrl || "")}">
    <input type="hidden" name="lang" value="${escapeHtml(values.lang || getOffLang())}">
    <div class="form-grid">
      <label>Idioma OFF<select name="offLang" data-action="ingredient-lang-select">${renderLanguageOptions(values.lang || getOffLang())}</select></label>
      <label>Nombre ingrediente<input name="name" required value="${escapeHtml(values.name || "")}" placeholder="Ej. Tomate frito"></label>
      <label>Familia<select name="familyId">${familyOptions}</select></label>
      <label>Cantidad en stock<input name="qty" type="number" step="0.01" min="0" value="${escapeHtml(String(values.qty ?? 0))}"></label>
      <label>Unidad<select name="unit">${unitOptions(values.unit || "g")}</select></label>
      <label>Caducidad<input name="expiryDate" type="date" value="${escapeHtml(values.expiryDate || "")}"></label>
      <label>Tipo de fecha<select name="dateType"><option value="expiry">Caducidad</option><option value="bestBefore">Consumo preferente</option><option value="none" ${!values.expiryDate ? "selected" : ""}>Sin fecha</option></select></label>
      <label>Conservación<select name="storageType"><option value="pantry">Despensa</option><option value="fridge">Nevera</option><option value="freezer">Congelador</option></select></label>
      <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="${escapeHtml(String(values.approxPrice || 0))}"></label>
      <label>Tipo de envase<select name="packagingType">${packagingOptions(values.packagingType || "otro")}</select></label>
      <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(values.barcode || "")}"></label>
      <label>Marca<input name="brand" value="${escapeHtml(values.brand || "")}"></label>
      <label>Nombre producto<input name="productName" value="${escapeHtml(values.productName || "")}"></label>
      <label>Peso/cantidad del envase<input name="packageQty" type="number" step="0.01" min="0" value="${escapeHtml(String(values.packageQty || values.qty || 0))}"></label>
      <label>Unidad envase<select name="packageUnit">${unitOptions(values.packageUnit || values.unit || "g")}</select></label>
      <label>Ración declarada<input name="servingQty" type="number" step="0.01" min="0" value="${escapeHtml(String(values.servingQty || 0))}"></label>
      <label>Unidad ración<select name="servingUnit">${unitOptions(values.servingUnit || "g")}</select></label>
    </div>
    <label>Ingredientes declarados<textarea name="ingredientsText" rows="2">${escapeHtml(values.ingredientsText || "")}</textarea></label>
    <label>Notas / alérgenos / etiquetas<textarea name="notes" rows="2">${escapeHtml([values.allergens, values.labels, values.categories].filter(Boolean).join(" · "))}</textarea></label>
    <details class="small"><summary>Datos técnicos importados</summary>
      <div class="form-grid">
        <label>Envase texto<input name="packaging" value="${escapeHtml(values.packaging || "")}"></label>
        <label>Categorías<input name="categories" value="${escapeHtml(values.categories || "")}"></label>
        <label>Etiquetas<input name="labels" value="${escapeHtml(values.labels || "")}"></label>
        <label>Alérgenos<input name="allergens" value="${escapeHtml(values.allergens || "")}"></label>
        <label>Nutri-Score<input name="nutriscore" value="${escapeHtml(values.nutriscore || "")}"></label>
        <label>Eco-Score<input name="ecoscore" value="${escapeHtml(values.ecoscore || "")}"></label>
        <label>NOVA<input name="novaGroup" value="${escapeHtml(String(values.novaGroup || ""))}"></label>
      </div>
    </details>
  `;
}

function fillIngredientDraftForm(values) {
  const form = document.querySelector("form.ingredient-draft-form") || document.querySelector('form[data-form="ingredient"]');
  if (!form) return;
  form.innerHTML = `${renderIngredientDraftFields(values)}<button>Guardar ingrediente</button>`;
}

function renderLanguageOptions(selected = "es") {
  return LANGUAGES.map(([code, label]) => `<option value="${code}" ${selected === code ? "selected" : ""}>${label}</option>`).join("");
}

function unitOptions(selected = "g") {
  return ["g", "kg", "ml", "l", "unidades"].map(unit => `<option ${selected === unit ? "selected" : ""}>${unit}</option>`).join("");
}

function packagingOptions(selected = "otro") {
  return PACKAGING_TYPES.map(type => `<option ${selected === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
}

function openEditIngredientStockModal(ingredientId) {
  const state = getState();
  const ingredient = state.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}" ${f.id === ingredient.familyId ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("");
  const productList = (ingredient.products || []).map((p, index) => `
    <div class="item small">
      <strong>${escapeHtml(p.productName || p.barcode || `Producto ${index + 1}`)}</strong>
      <p class="qty-line">${escapeHtml(p.brand || "sin marca")} · ${escapeHtml(p.barcode || "sin código")} · ${Number(p.packageQty || 0).toLocaleString("es-ES")} ${escapeHtml(p.packageUnit || "")}</p>
    </div>`).join("");

  openModal(`
    <header><div><h2>Editar ingrediente y stock</h2><p class="muted">Corrige datos del alimento y gestiona productos/códigos asociados.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <form data-form="stock-adjust-enhanced" data-ingredient-id="${escapeHtml(ingredient.id)}">
      <div class="form-grid">
        <label>Nombre<input name="name" value="${escapeHtml(ingredient.name)}" required></label>
        <label>Familia<select name="familyId">${familyOptions}</select></label>
        <label>Cantidad<input name="qty" type="number" step="0.01" min="0" value="${escapeHtml(String(ingredient.qty))}"></label>
        <label>Unidad<select name="unit">${unitOptions(ingredient.unit)}</select></label>
        <label>Conservación<select name="storageType"><option value="pantry" ${ingredient.storageType === "pantry" ? "selected" : ""}>Despensa</option><option value="fridge" ${ingredient.storageType === "fridge" ? "selected" : ""}>Nevera</option><option value="freezer" ${ingredient.storageType === "freezer" ? "selected" : ""}>Congelador</option></select></label>
        <label>Caducidad<input name="expiryDate" type="date" value="${escapeHtml(ingredient.expiryDate || "")}"></label>
        <label>Tipo de fecha<select name="dateType"><option value="expiry" ${ingredient.dateType === "expiry" ? "selected" : ""}>Caducidad</option><option value="bestBefore" ${ingredient.dateType === "bestBefore" ? "selected" : ""}>Consumo preferente</option><option value="none" ${ingredient.dateType === "none" ? "selected" : ""}>Sin fecha</option></select></label>
        <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="${escapeHtml(String(ingredient.approxPrice || 0))}"></label>
        <label>Tipo de envase<select name="packagingType">${packagingOptions(ingredient.packagingType || "otro")}</select></label>
      </div>
      <label>Notas internas<textarea name="notes" placeholder="Correcciones, equivalencias, observaciones...">${escapeHtml(ingredient.notes || "")}</textarea></label>
      <button>Guardar cambios</button>
    </form>
    <section class="card nested-card">
      <div class="section-title-row"><h3>Productos/códigos asociados</h3><button class="secondary" data-action="scan-existing-ingredient-barcode" data-ingredient-id="${escapeHtml(ingredient.id)}">Escanear y añadir código</button></div>
      <div class="list">${productList || `<p class="muted">Aún no hay productos asociados.</p>`}</div>
    </section>`);
}

function saveStockAdjustEnhanced(form) {
  const data = formToObject(form);
  updateState(draft => {
    const ingredient = draft.ingredients.find(i => i.id === form.dataset.ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    ingredient.name = stripDangerousText(data.name || ingredient.name);
    ingredient.familyId = data.familyId || ingredient.familyId;
    ingredient.qty = parseNumber(data.qty);
    ingredient.unit = normalizeUnit(data.unit);
    ingredient.available = ingredient.qty > 0;
    ingredient.storageType = data.storageType || ingredient.storageType;
    ingredient.expiryDate = data.expiryDate || "";
    ingredient.dateType = data.dateType || "none";
    ingredient.approxPrice = parseNumber(data.approxPrice);
    ingredient.packagingType = normalizePackagingType(data.packagingType || "otro");
    ingredient.notes = stripDangerousText(data.notes || "");
    ingredient.updatedAt = new Date().toISOString();
  }, "stock-adjust-enhanced");
  closeModal();
  showAlert("Ingrediente y stock actualizados.");
}

function openAddBarcodeModal(ingredientId, product = {}) {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;
  openModal(`
    <header><div><h2>Añadir producto a ${escapeHtml(ingredient.name)}</h2><p class="muted">Asocia otra marca o código de barras al mismo ingrediente.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <form data-form="barcode-product" data-ingredient-id="${escapeHtml(ingredientId)}">
      ${renderProductFields(product)}
      <button>Guardar producto asociado</button>
    </form>`);
}

function openScanExistingIngredientModal(ingredientId) {
  openModal(`
    <header><div><h2>Escanear producto asociado</h2><p class="muted">Se añadirá como código/marca alternativa al ingrediente existente.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <div class="scanner-box"><video id="ingredientScanVideo" class="scanner-video" autoplay muted playsinline></video><div class="scanner-frame"></div><p id="ingredientScanStatus" class="muted">Activando cámara...</p></div>
    <form data-form="barcode-product" data-ingredient-id="${escapeHtml(ingredientId)}">${renderProductFields({})}<button>Guardar producto asociado</button></form>
  `);
}

async function startExistingIngredientScan(ingredientId) {
  const video = document.getElementById("ingredientScanVideo");
  const status = document.getElementById("ingredientScanStatus");
  const barcode = await scanBarcodeWithPreview(video, status);
  status.textContent = `Código detectado: ${barcode}. Buscando datos...`;
  const product = await lookupOpenFoodFacts(barcode, { lang: getOffLang() });
  const form = document.querySelector('form[data-form="barcode-product"]');
  if (form) form.innerHTML = `${renderProductFields(product ? productToDraft(product) : { barcode, productSource: "manual" })}<button>Guardar producto asociado</button>`;
}

function renderProductFields(values = {}) {
  return `
    <input type="hidden" name="productSource" value="${escapeHtml(values.productSource || "openfoodfacts")}">
    <input type="hidden" name="lang" value="${escapeHtml(values.lang || getOffLang())}">
    <div class="form-grid">
      <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(values.barcode || "")}"></label>
      <label>Marca<input name="brand" value="${escapeHtml(values.brand || "")}"></label>
      <label>Nombre producto<input name="productName" value="${escapeHtml(values.productName || "")}"></label>
      <label>Cantidad envase<input name="packageQty" type="number" step="0.01" value="${escapeHtml(String(values.packageQty || 0))}"></label>
      <label>Unidad envase<select name="packageUnit">${unitOptions(values.packageUnit || "g")}</select></label>
      <label>Tipo envase<select name="packagingType">${packagingOptions(values.packagingType || "otro")}</select></label>
    </div>
    <label>Ingredientes declarados<textarea name="ingredientsText">${escapeHtml(values.ingredientsText || "")}</textarea></label>
    <label>Datos útiles<textarea name="notes">${escapeHtml([values.allergens, values.labels, values.categories].filter(Boolean).join(" · "))}</textarea></label>
    <input type="hidden" name="genericName" value="${escapeHtml(values.genericName || "")}">
    <input type="hidden" name="packaging" value="${escapeHtml(values.packaging || "")}">
    <input type="hidden" name="categories" value="${escapeHtml(values.categories || "")}">
    <input type="hidden" name="labels" value="${escapeHtml(values.labels || "")}">
    <input type="hidden" name="allergens" value="${escapeHtml(values.allergens || "")}">
    <input type="hidden" name="nutriscore" value="${escapeHtml(values.nutriscore || "")}">
    <input type="hidden" name="ecoscore" value="${escapeHtml(values.ecoscore || "")}">
    <input type="hidden" name="novaGroup" value="${escapeHtml(String(values.novaGroup || ""))}">
    <input type="hidden" name="imageUrl" value="${escapeHtml(values.imageUrl || "")}">
  `;
}

function saveBarcodeProduct(form) {
  const data = formToObject(form);
  const product = productFromFormData(data);
  updateState(draft => {
    const ingredient = draft.ingredients.find(i => i.id === form.dataset.ingredientId);
    if (!ingredient) throw new Error("Ingrediente no encontrado.");
    ingredient.products ||= [];
    const existingIndex = ingredient.products.findIndex(p => p.barcode && p.barcode === product.barcode);
    if (existingIndex >= 0) ingredient.products[existingIndex] = { ...ingredient.products[existingIndex], ...product, updatedAt: new Date().toISOString() };
    else ingredient.products.push(product);
    if (!ingredient.packagingType || ingredient.packagingType === "otro") ingredient.packagingType = product.packagingType || "otro";
    ingredient.updatedAt = new Date().toISOString();
  }, "ingredient-product-add");
  closeModal();
  showAlert("Producto/código asociado al ingrediente.");
}

function saveUsdaSettings(form) {
  const data = formToObject(form);
  setSessionUsdaApiKey(data.usdaApiKey || "");
  if (data.offLang) setOffLang(data.offLang);
  showAlert("Ajustes de APIs guardados para esta sesión/navegador.");
}

function openOpenFoodFactsModal(ingredientId = "") {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  openModal(`
    <header><div><h2>Buscar en Open Food Facts</h2><p class="muted">${ingredient ? `Asociar producto a ${escapeHtml(ingredient.name)}` : "Crear una ficha temporal editable antes de guardar"}.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <div class="search-panel" data-ingredient-id="${escapeHtml(ingredientId)}">
      <div class="form-grid">
        <label>Idioma de búsqueda<select id="offLang">${renderLanguageOptions(getOffLang())}</select></label>
        <label>Buscar alimento o marca<input id="offSearchQuery" value="${escapeHtml(ingredient?.name || "")}" placeholder="Ej. tomate frito"></label>
      </div>
      <div class="actions"><button type="button" data-action="search-off-products">Buscar productos</button></div>
      <div id="offSearchResults" class="list results-list"><p class="muted">Busca y elige un resultado para rellenar una ficha editable.</p></div>
    </div>
  `);
}

async function searchOffIntoModal() {
  const query = document.getElementById("offSearchQuery")?.value || "";
  const lang = document.getElementById("offLang")?.value || getOffLang();
  setOffLang(lang);
  const root = document.getElementById("offSearchResults");
  const ingredientId = document.querySelector(".search-panel")?.dataset.ingredientId || "";
  root.innerHTML = `<p class="muted">Buscando...</p>`;
  offResults = await searchOpenFoodFacts(query, { lang });
  root.innerHTML = offResults.length ? offResults.map((product, index) => renderOffResult(product, index, ingredientId)).join("") : `<p class="muted">No se encontraron productos.</p>`;
}

function renderOffResult(product, index, ingredientId) {
  return `
    <div class="item">
      <strong>${escapeHtml(product.productName || "Producto")}</strong>
      <p class="qty-line">${escapeHtml(product.brand || "sin marca")} · ${escapeHtml(product.quantity || `${product.packageQty || 0} ${product.packageUnit || ""}`)} · ${escapeHtml(product.barcode || "")}</p>
      <p class="small muted">Envase: ${escapeHtml(product.packagingType || "otro")} · Nutri-Score: ${escapeHtml(product.nutriscore || "n/d")}</p>
      <button data-action="import-off-product" data-index="${index}" data-ingredient-id="${escapeHtml(ingredientId)}">${ingredientId ? "Asociar a ingrediente" : "Usar para nueva ficha"}</button>
    </div>`;
}

function importOffProduct(index, ingredientId = "") {
  const product = offResults[index];
  if (!product) throw new Error("Resultado Open Food Facts no encontrado.");
  if (ingredientId) {
    openAddBarcodeModal(ingredientId, productToDraft(product));
  } else {
    openModal(`
      <header><div><h2>Nueva ficha desde Open Food Facts</h2><p class="muted">Revisa, completa caducidad/stock y guarda el ingrediente.</p></div><button class="secondary" data-action="close-modal">×</button></header>
      <form data-form="ingredient" class="ingredient-draft-form">${renderIngredientDraftFields(productToDraft(product))}<button>Guardar ingrediente</button></form>
    `);
  }
}

function openUsdaModal(ingredientId = "") {
  const ingredient = getState().ingredients.find(i => i.id === ingredientId);
  openModal(`
    <header>
      <div><h2>Buscar en USDA FoodData Central</h2><p class="muted">${ingredient ? `Guardar nutrición para ${escapeHtml(ingredient.name)}` : "Crear ingrediente con perfil nutricional"}. Usa la key de Ajustes o DEMO_KEY para pruebas.</p></div>
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
        packagingType: "otro",
        products: []
      }, "ingredient");
      draft.ingredients.push(ingredient);
    }
    const profile = nutritionProfileFromUsdaFood(food, ingredient.id);
    draft.nutritionProfiles = draft.nutritionProfiles.filter(n => n.ingredientId !== ingredient.id || n.source !== "usda-fooddata-central");
    draft.nutritionProfiles.push(withMeta(profile, "nutrition"));
  }, "usda-import-enhanced");
  closeModal();
  showAlert("Perfil nutricional importado desde USDA.");
}
