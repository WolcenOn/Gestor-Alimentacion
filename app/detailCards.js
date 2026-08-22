import { getState } from "./store.js";
import { escapeHtml, formatMoney } from "./utils.js";
import { openModal } from "./render/ui.js";
import { computeDishNutrition, computeIngredientNutrition, formatNutritionValue, missingIngredientNames, NUTRIENTS } from "./state/nutritionCalculator.js";
import { getCanonicalIngredientProducts, isPricesApiConfigured, pickBestIngredientProduct } from "./services/pricesApi.js";

function formatNumber(value, digits = 2) {
  const n = Number(value || 0);
  return n.toLocaleString("es-ES", { maximumFractionDigits: digits });
}

function storageLabel(value) {
  return ({ pantry: "Despensa", fridge: "Nevera", freezer: "Congelador" })[value] || value || "Sin zona";
}

function nutritionFacts(total) {
  return `
    <div class="mini-facts nutrition-detail-facts">
      ${NUTRIENTS.map(([key, label]) => `<span>${escapeHtml(label)}: ${escapeHtml(formatNutritionValue(key, total?.[key]))}</span>`).join("")}
    </div>
  `;
}

function primaryProduct(ingredient) {
  return (ingredient.products || []).find(product => product.imageUrl || product.image_url || product.image_front_url) || (ingredient.products || [])[0] || {};
}

function productImage(product) {
  return product.imageUrl || product.image_url || product.image_front_url || product.imageSmallUrl || "";
}

function ingredientProfile(state, ingredientId) {
  return state.nutritionProfiles.find(profile => profile.ingredientId === ingredientId) || null;
}

function renderInstructions(dish) {
  const steps = Array.isArray(dish.instructions) ? dish.instructions.filter(Boolean) : [];
  if (steps.length) {
    return `<ol class="detail-steps">${steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`;
  }
  if (dish.notes) return `<p>${escapeHtml(dish.notes)}</p>`;
  return `<p class="muted">Sin elaboración registrada todavía.</p>`;
}

function renderDishIngredientLines(state, dish) {
  const lines = dish.recipe || [];
  if (!lines.length) return `<p class="muted">Sin ingredientes registrados.</p>`;
  return `
    <div class="list compact-list">
      ${lines.map(line => {
        const ingredient = state.ingredients.find(item => item.id === line.ingredientId);
        const profile = ingredientProfile(state, line.ingredientId);
        const nutri = computeIngredientNutrition(state, line.ingredientId, line.qty, line.unit);
        return `
          <div class="item compact-detail-line">
            <div>
              <strong>${escapeHtml(ingredient?.name || "Ingrediente eliminado")}</strong>
              <p class="qty-line">${formatNumber(line.qty)} ${escapeHtml(line.unit || ingredient?.unit || "g")}${profile ? " · nutrición disponible" : " · nutrición pendiente"}</p>
            </div>
            <span class="badge">${Math.round(nutri.total.kcal || 0)} kcal</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function openDishDetailCard(dishId) {
  const state = getState();
  const dish = state.dishes.find(item => item.id === dishId);
  if (!dish) return;
  const nutrition = computeDishNutrition(state, dish.id);
  const missing = missingIngredientNames(state, nutrition.missing || []);
  const tags = Array.isArray(dish.tags) ? dish.tags : [];
  openModal(`
    <header>
      <div>
        <p class="eyebrow">Ficha del plato</p>
        <h2>${escapeHtml(dish.name)}</h2>
        <p class="muted">${escapeHtml(dish.category || "Sin categoría")}${dish.servings ? ` · ${formatNumber(dish.servings)} ración(es)` : ""}${dish.prepTime ? ` · ${escapeHtml(dish.prepTime)}` : ""}</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>

    ${tags.length ? `<div class="tag-list">${tags.map(tag => `<span class="mini-badge">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}

    <section class="detail-section">
      <h3>Resumen nutricional del plato</h3>
      ${nutritionFacts(nutrition.total)}
      ${missing.length ? `<p class="alert">Faltan perfiles nutricionales para: ${escapeHtml(missing.join(", "))}</p>` : `<p class="small muted">Valores aproximados calculados con los ingredientes registrados.</p>`}
    </section>

    <section class="detail-section">
      <h3>Ingredientes y cantidades</h3>
      ${renderDishIngredientLines(state, dish)}
    </section>

    <section class="detail-section">
      <h3>Forma de elaboración</h3>
      ${renderInstructions(dish)}
    </section>
  `);
}

function renderIngredientProducts(ingredient) {
  const products = ingredient.products || [];
  if (!products.length) return `<p class="muted">Sin productos asociados.</p>`;
  return `
    <div class="list compact-list">
      ${products.map(product => `
        <div class="item compact-detail-line">
          <div>
            <strong>${escapeHtml(product.productName || ingredient.name)}</strong>
            <p class="qty-line">${escapeHtml(product.brand || "Sin marca")}${product.barcode ? ` · ${escapeHtml(product.barcode)}` : ""}</p>
            <p class="small muted">${[product.packageQty ? `${formatNumber(product.packageQty)} ${product.packageUnit || ingredient.unit || ""}` : "", product.packagingType || product.packaging || ""].filter(Boolean).map(escapeHtml).join(" · ")}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function supermarketPriceRootId(ingredientId) {
  return `ingredient-supermarket-price-${String(ingredientId || "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function renderSupermarketPriceSection(ingredient) {
  if (!ingredient.canonicalIngredientId) return "";
  return `
    <section class="detail-section">
      <div class="section-title-row">
        <div>
          <h3>Precio supermercado</h3>
          <p class="small muted">Dato externo actual. No sustituye el precio base/manual del ingrediente.</p>
        </div>
        <button type="button" class="secondary" data-action="refresh-ingredient-supermarket-price" data-ingredient-id="${escapeHtml(ingredient.id)}">Actualizar</button>
      </div>
      <div id="${escapeHtml(supermarketPriceRootId(ingredient.id))}">
        <p class="muted">Consultando precio actual...</p>
      </div>
    </section>`;
}

function formatObservedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderExternalProductPrice(ingredient, item) {
  const product = item?.product;
  if (!product) return `<p class="muted">No hay un producto disponible con precio actual.</p>`;
  const packageText = Number(product.packageAmount) > 0
    ? `${formatNumber(product.packageAmount, 3)} ${escapeHtml(product.packageUnit || "")}`
    : "formato no indicado";
  const unitPrice = Number(product.pricePerUnit) > 0
    ? `${formatMoney(product.pricePerUnit)} / ${escapeHtml(product.priceUnit || product.packageUnit || "unidad")}`
    : "";
  const observed = formatObservedAt(product.observedAt);
  const supermarket = String(product.supermarketId || "supermercado").toUpperCase();

  return `
    <div class="item price-source-card">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(supermarket)} · ${escapeHtml(product.name || ingredient.name)}</strong>
          <p class="qty-line">${formatMoney(product.price)} por ${packageText}${unitPrice ? ` · ${unitPrice}` : ""}</p>
        </div>
        <span class="badge success">${formatMoney(product.price)}</span>
      </div>
      <div class="mini-facts">
        <span>Canónico: ${escapeHtml(ingredient.canonicalIngredientName || ingredient.canonicalIngredientId)}</span>
        <span>CP: ${escapeHtml(product.postalCode || "general")}</span>
        ${observed ? `<span>Actualizado: ${escapeHtml(observed)}</span>` : ""}
      </div>
      <p class="small muted">Fuente: Supermarket Prices API${item.matchStatus ? ` · match ${escapeHtml(item.matchStatus)}` : ""}.</p>
    </div>`;
}

async function loadIngredientSupermarketPrice(ingredient) {
  if (!ingredient?.canonicalIngredientId) return;
  const root = document.getElementById(supermarketPriceRootId(ingredient.id));
  if (!root) return;
  if (!isPricesApiConfigured()) {
    root.innerHTML = `<p class="alert">La API de precios no está configurada.</p>`;
    return;
  }

  root.innerHTML = `<p class="muted">Consultando precio actual...</p>`;
  try {
    const payload = await getCanonicalIngredientProducts({ ingredientId: ingredient.canonicalIngredientId });
    const best = pickBestIngredientProduct(payload?.items || []);
    const currentRoot = document.getElementById(supermarketPriceRootId(ingredient.id));
    if (currentRoot) currentRoot.innerHTML = renderExternalProductPrice(ingredient, best);
  } catch (error) {
    const currentRoot = document.getElementById(supermarketPriceRootId(ingredient.id));
    if (currentRoot) currentRoot.innerHTML = `<p class="alert">${escapeHtml(error.message || "No se pudo consultar el precio del supermercado.")}</p>`;
  }
}

export function openIngredientDetailCard(ingredientId) {
  const state = getState();
  const ingredient = state.ingredients.find(item => item.id === ingredientId);
  if (!ingredient) return;
  const family = state.ingredientFamilies.find(item => item.id === ingredient.familyId)?.name || "Sin familia";
  const product = primaryProduct(ingredient);
  const image = productImage(product);
  const profile = ingredientProfile(state, ingredient.id);
  const nutrition100 = computeIngredientNutrition(state, ingredient.id, 100, profile?.unit || ingredient.unit || "g");
  const nutritionStock = computeIngredientNutrition(state, ingredient.id, ingredient.qty, ingredient.unit || profile?.unit || "g");
  const lots = (state.purchaseLots || []).filter(lot => lot.ingredientId === ingredient.id).slice(-5).reverse();

  openModal(`
    <header>
      <div>
        <p class="eyebrow">Ficha del ingrediente</p>
        <h2>${escapeHtml(ingredient.name)}</h2>
        <p class="muted">${escapeHtml(family)} · ${escapeHtml(storageLabel(ingredient.storageType))}</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>

    ${image ? `<img class="detail-hero-image" src="${escapeHtml(image)}" alt="${escapeHtml(ingredient.name)}" loading="lazy">` : ""}

    <section class="detail-section">
      <h3>Stock registrado</h3>
      <div class="mini-facts">
        <span>Total: ${formatNumber(ingredient.qty)} ${escapeHtml(ingredient.unit)}</span>
        <span>Caducidad: ${escapeHtml(ingredient.expiryDate || "sin fecha")}</span>
        <span>Envase: ${escapeHtml(ingredient.packagingType || product.packagingType || product.packaging || "sin envase")}</span>
        <span>Precio base: ${formatNumber(ingredient.approxPrice || 0, 3)} €</span>
      </div>
      ${lots.length ? `<p class="small muted">Últimos lotes: ${lots.map(lot => `${formatNumber(lot.qty)} ${lot.unit || ingredient.unit}`).join(" · ")}</p>` : `<p class="small muted">Sin lotes de compra detallados registrados.</p>`}
    </section>

    ${renderSupermarketPriceSection(ingredient)}

    <section class="detail-section">
      <h3>Valores nutricionales</h3>
      ${profile ? `
        <p class="small muted">Por ${formatNumber(profile.per || 100)} ${escapeHtml(profile.unit || ingredient.unit || "g")} · fuente: ${escapeHtml(profile.source || "manual")}</p>
        ${nutritionFacts(nutrition100.total)}
        <h4>Total estimado en stock</h4>
        ${nutritionFacts(nutritionStock.total)}
      ` : `<p class="alert">Sin perfil nutricional. Puedes buscarlo en Open Food Facts o USDA.</p>`}
    </section>

    <section class="detail-section">
      <h3>Producto asociado</h3>
      ${renderIngredientProducts(ingredient)}
    </section>
  `);

  void loadIngredientSupermarketPrice(ingredient);
}

window.GestorDetailCards = {
  openDish: openDishDetailCard,
  openIngredient: openIngredientDetailCard
};

document.addEventListener("click", event => {
  const dishButton = event.target.closest('[data-action="open-dish-detail"]');
  if (dishButton) {
    event.preventDefault();
    event.stopPropagation();
    openDishDetailCard(dishButton.dataset.dishId);
    return;
  }
  const ingredientButton = event.target.closest('[data-action="open-ingredient-detail"]');
  if (ingredientButton) {
    event.preventDefault();
    event.stopPropagation();
    openIngredientDetailCard(ingredientButton.dataset.ingredientId);
    return;
  }
  const refreshPriceButton = event.target.closest('[data-action="refresh-ingredient-supermarket-price"]');
  if (refreshPriceButton) {
    event.preventDefault();
    event.stopPropagation();
    const ingredient = getState().ingredients.find(item => item.id === refreshPriceButton.dataset.ingredientId);
    if (ingredient) void loadIngredientSupermarketPrice(ingredient);
  }
}, true);
