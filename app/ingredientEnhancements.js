import { getState, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { escapeHtml, stripDangerousText, parseNumber, normalizeUnit } from "./utils.js";
import { showAlert, openModal, closeModal, renderBarcodeScannerModal, formToObject } from "./render/ui.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { normalizePackagingType } from "./state/wasteRecycling.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
let usdaResults = [];

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
      openModal(renderBarcodeScannerModal({ title: "Escanear nuevo alimento", target: "ingredient", ingredientId: "" }));
    }

    if (action === "edit-ingredient-stock") {
      stop(event);
      openEditIngredientStockModal(button.dataset.ingredientId);
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
    if (form.dataset.form === "ingredient-enhanced") {
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
  } catch (error) {
    console.error(error);
    showAlert(error.message || "Ha ocurrido un error.", "error");
  }
}, true);

function addIngredientEnhanced(form) {
  const data = formToObject(form);
  updateState(draft => {
    const ingredient = withMeta({
      name: stripDangerousText(data.name),
      familyId: data.familyId,
      qty: parseNumber(data.qty),
      unit: normalizeUnit(data.unit),
      available: parseNumber(data.qty) > 0,
      storageType: data.storageType,
      expiryDate: data.expiryDate || "",
      dateType: data.dateType || "none",
      approxPrice: parseNumber(data.approxPrice),
      packagingType: normalizePackagingType(data.packagingType || "otro"),
      notes: stripDangerousText(data.notes || ""),
      products: []
    }, "ingredient");

    if (data.barcode) {
      ingredient.products.push({
        barcode: stripDangerousText(data.barcode),
        brand: stripDangerousText(data.brand || ""),
        productName: stripDangerousText(data.productName || data.name),
        packageQty: parseNumber(data.qty),
        packageUnit: normalizeUnit(data.unit),
        price: parseNumber(data.approxPrice),
        source: "manual",
        packagingType: normalizePackagingType(data.packagingType || "otro"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    draft.ingredients.push(ingredient);
  }, "ingredient-add-enhanced");
  form.reset();
  showAlert("Ingrediente añadido con datos de envase.");
}

function openEditIngredientStockModal(ingredientId) {
  const state = getState();
  const ingredient = state.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}" ${f.id === ingredient.familyId ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("");
  const unitOption = unit => `<option ${ingredient.unit === unit ? "selected" : ""}>${unit}</option>`;
  const storageOption = (value, label) => `<option value="${value}" ${ingredient.storageType === value ? "selected" : ""}>${label}</option>`;
  const dateOption = (value, label) => `<option value="${value}" ${ingredient.dateType === value ? "selected" : ""}>${label}</option>`;
  const packagingTypes = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];
  const selectedPackaging = ingredient.packagingType || ingredient.products?.find(p => p.packagingType)?.packagingType || "otro";

  openModal(`
    <header><div><h2>Editar ingrediente y stock</h2><p class="muted">Corrige datos del alimento ya almacenado.</p></div><button class="secondary" data-action="close-modal">×</button></header>
    <form data-form="stock-adjust-enhanced" data-ingredient-id="${escapeHtml(ingredient.id)}">
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

function saveUsdaSettings(form) {
  const data = formToObject(form);
  setSessionUsdaApiKey(data.usdaApiKey || "");
  showAlert(data.usdaApiKey ? "API key de USDA guardada solo para esta sesión." : "API key de USDA borrada de esta sesión. Se usará DEMO_KEY para pruebas.");
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
