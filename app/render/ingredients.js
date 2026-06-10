import { escapeHtml } from "../utils.js";

const PACKAGING_OPTIONS = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];
const UNIT_OPTIONS = ["g", "kg", "ml", "l", "unidades"];

export function renderIngredients(state) {
  const familyOptions = state.ingredientFamilies.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
  const packagingOptions = PACKAGING_OPTIONS.map(type => `<option>${escapeHtml(type)}</option>`).join("");
  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Alta de alimentos y stock</p>
        <h2>Ingredientes</h2>
        <p class="muted">Consulta el stock rápidamente o despliega el formulario solo cuando quieras añadir alimentos.</p>
      </div>
      <div class="header-actions compact-actions">
        <button class="secondary" data-action="scan-new-ingredient">Escanear nuevo alimento</button>
        <button class="secondary" data-action="open-off-search">Buscar Open Food Facts</button>
        <button class="secondary" data-action="open-usda-search">Buscar USDA</button>
      </div>
    </div>

    <div class="stacked-layout">
      <details class="card collapsible-card">
        <summary class="collapsible-summary">
          <span>
            <strong>Nuevo ingrediente</strong>
            <small>Escaneo, Open Food Facts, USDA o alta manual</small>
          </span>
          <span class="summary-hint">Desplegar</span>
        </summary>
        <div class="collapsible-body">
          <p class="muted">El escaneo y las búsquedas rellenan nombre, producto, nutrición y envase cuando la base de datos lo ofrece.</p>
          <div class="quick-actions ingredients-import-actions">
            <button type="button" data-action="scan-new-ingredient">Escanear código</button>
            <button type="button" class="secondary" data-action="open-off-search">Buscar en Open Food Facts</button>
            <button type="button" class="secondary" data-action="open-usda-search">Buscar en USDA</button>
          </div>
          <form data-form="ingredient">
            <div class="form-grid">
              <label>Nombre<input name="name" required placeholder="Ej. Huevos"></label>
              <label>Familia<select name="familyId">${familyOptions}</select></label>
              <label>Cantidad inicial<input name="qty" type="number" step="0.01" min="0" required value="0"></label>
              <label>Unidad<select name="unit"><option>g</option><option>kg</option><option>ml</option><option>l</option><option>unidades</option></select></label>
              <label>Conservación<select name="storageType"><option value="pantry">Despensa</option><option value="fridge">Nevera</option><option value="freezer">Congelador</option></select></label>
              <label>Caducidad<input name="expiryDate" type="date"></label>
              <label>Tipo de fecha<select name="dateType"><option value="expiry">Caducidad</option><option value="bestBefore">Consumo preferente</option><option value="none">Sin fecha</option></select></label>
              <label>Precio aprox. por unidad base<input name="approxPrice" type="number" step="0.001" min="0" value="0"></label>
              <label>Tipo de envase<select name="packagingType">${packagingOptions}</select></label>
              <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" placeholder="opcional"></label>
              <label>Marca<input name="brand" placeholder="opcional"></label>
              <label>Nombre del producto<input name="productName" placeholder="opcional"></label>
            </div>
            <button>Añadir ingrediente</button>
          </form>
        </div>
      </details>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Stock actual</h3>
            <p class="muted">Busca por nombre, familia, envase, cantidad, producto asociado o estado nutricional.</p>
          </div>
          <span class="badge">${state.ingredients.length} ingredientes</span>
        </div>
        <label class="quick-search-label">Búsqueda rápida de ingredientes
          <input type="search" class="quick-search" placeholder="Ej. tomate, nevera, vidrio, compra rápida..." data-search-target=".ingredient-list .ingredient-item" data-empty-target="ingredientSearchEmpty">
        </label>
        <div id="ingredientSearchEmpty" class="search-empty muted" hidden>No hay ingredientes que coincidan con la búsqueda.</div>
        <div class="list ingredient-list">
          ${state.ingredients.map(i => renderIngredientItem(state, i)).join("")}
        </div>
      </article>
    </div>
  `;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 3 });
}

function primaryFastProduct(ingredient) {
  return (ingredient.products || []).find(p => p.barcode && Number(p.packageQty || p.packageQuantity || 0) > 0 && (p.packageUnit || p.unit || p.lastPurchasedUnit))
    || (ingredient.products || [])[0]
    || {};
}

function latestPackageInfo(state, ingredient) {
  const lots = (state.purchaseLots || [])
    .filter(lot => lot.ingredientId === ingredient.id && Number(lot.packageCount) > 0 && Number(lot.packageSizeQty) > 0)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const lot = lots[0];
  if (lot) {
    return `${formatNumber(lot.packageCount)} envase(s) × ${formatNumber(lot.packageSizeQty)} ${lot.packageSizeUnit || lot.unit} = ${formatNumber(lot.qty)} ${lot.unit}`;
  }
  const product = primaryFastProduct(ingredient);
  if (!product.packageQty) return "";
  const count = Number(product.packageCount || 1);
  const total = Number(product.lastPurchasedQty || (Number(product.packageQty || 0) * count));
  return `${formatNumber(count)} envase(s) × ${formatNumber(product.packageQty)} ${product.packageUnit || ingredient.unit} = ${formatNumber(total)} ${product.lastPurchasedUnit || product.packageUnit || ingredient.unit}`;
}

function hasFastPurchaseData(ingredient) {
  const product = primaryFastProduct(ingredient);
  return Boolean(product.barcode && Number(product.packageQty || product.packageQuantity || 0) > 0 && (product.packageUnit || product.unit || product.lastPurchasedUnit));
}

function isFastPurchaseEnabled(ingredient) {
  return Boolean(ingredient.trustedPurchase || ingredient.quickPurchaseTrusted || ingredient.trustedPurchaseEnabled);
}

function optionList(values, selected) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${String(selected || "") === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function renderFastPurchasePanel(ingredient) {
  const product = primaryFastProduct(ingredient);
  const enabled = isFastPurchaseEnabled(ingredient);
  const packageQty = Number(product.packageQty || product.packageQuantity || 0) || "";
  const packageUnit = product.packageUnit || product.unit || product.lastPurchasedUnit || ingredient.unit || "g";
  const packageCount = Number(product.packageCount || 1) || 1;
  const total = packageQty ? Number(packageQty) * packageCount : 0;
  return `
    <details class="fast-purchase-panel">
      <summary>${enabled ? "Compra rápida activa" : "Configurar compra rápida"}</summary>
      <form data-form="fast-purchase-settings" data-ingredient-id="${escapeHtml(ingredient.id)}">
        <label class="check-row">
          <input type="checkbox" name="trustedPurchase" value="true" ${enabled ? "checked" : ""}>
          <span><strong>Activar compra rápida en Compra</strong><small>Al escanear, solo pedirá nº de envases y calculará el total.</small></span>
        </label>
        <div class="form-grid">
          <label>Código de barras<input name="barcode" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(product.barcode || "")}" placeholder="Ej. 8412345678901"></label>
          <label>Marca<input name="brand" value="${escapeHtml(product.brand || "")}" placeholder="opcional"></label>
          <label>Nombre producto<input name="productName" value="${escapeHtml(product.productName || ingredient.name || "")}" placeholder="Ej. Leche entera"></label>
          <label>Cantidad por envase<input name="packageQty" type="number" step="0.01" min="0" value="${escapeHtml(String(packageQty))}" placeholder="Ej. 1"></label>
          <label>Unidad envase<select name="packageUnit">${optionList(UNIT_OPTIONS, packageUnit)}</select></label>
          <label>Envases habituales<input name="packageCount" type="number" step="1" min="1" value="${escapeHtml(String(packageCount))}"></label>
          <label>Tipo de envase<select name="packagingType">${optionList(PACKAGING_OPTIONS, product.packagingType || ingredient.packagingType || "otro")}</select></label>
        </div>
        <p class="small muted">Total habitual: ${total ? `${formatNumber(total)} ${escapeHtml(packageUnit)}` : "rellena cantidad y unidad"}. En Compra se recalculará según los envases comprados.</p>
        <div class="actions"><button type="submit" class="secondary">Guardar compra rápida</button></div>
      </form>
    </details>
  `;
}

function renderIngredientItem(state, i) {
  const family = state.ingredientFamilies.find(f => f.id === i.familyId)?.name || "Sin familia";
  const nutrition = state.nutritionProfiles.find(n => n.ingredientId === i.id);
  const productCount = (i.products || []).length;
  const fastReady = hasFastPurchaseData(i);
  const fastEnabled = isFastPurchaseEnabled(i);
  const productText = (i.products || []).map(p => [p.productName, p.brand, p.barcode, p.packagingType, p.packaging, p.packageQty, p.packageUnit].filter(Boolean).join(" ")).join(" ");
  const packaging = i.packagingType || i.products?.find(p => p.packagingType || p.packaging)?.packagingType || i.products?.find(p => p.packaging)?.packaging || "sin envase";
  const packageInfo = latestPackageInfo(state, i);
  const searchText = [i.name, family, i.qty, i.unit, packageInfo, i.expiryDate || "sin fecha", i.storageType, packaging, nutrition ? "nutrición sí" : "nutrición pendiente", fastEnabled ? "compra rápida confianza" : "compra normal", productText].join(" ");
  return `
    <div class="item ingredient-item" data-search="${escapeHtml(searchText)}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(i.name)}</strong>
          <p class="qty-line">Stock total: ${formatNumber(i.qty)} ${escapeHtml(i.unit)} · ${escapeHtml(family)}</p>
          ${packageInfo ? `<p class="small muted">Última compra/envase: ${escapeHtml(packageInfo)}</p>` : ""}
        </div>
        ${i.expiryDate ? `<span class="badge warning">${escapeHtml(i.expiryDate)}</span>` : `<span class="badge">sin fecha</span>`}
      </div>
      <div class="mini-facts">
        <span>Productos asociados: ${productCount}</span>
        <span>Nutrición: ${nutrition ? "sí" : "pendiente"}</span>
        <span>Envase: ${escapeHtml(packaging)}</span>
        <span>Compra rápida: ${fastEnabled ? "activa" : "no"}${fastReady ? "" : " · incompleta"}</span>
      </div>
      ${renderFastPurchasePanel(i)}
      <div class="row-actions wrap">
        <button class="secondary" data-action="edit-stock" data-ingredient-id="${escapeHtml(i.id)}">Editar stock</button>
        <button class="secondary" data-action="open-waste-modal" data-ingredient-id="${escapeHtml(i.id)}">Tirar</button>
        <button class="danger" data-action="delete-ingredient" data-ingredient-id="${escapeHtml(i.id)}">Eliminar</button>
      </div>
    </div>`;
}
