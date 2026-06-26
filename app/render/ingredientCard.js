import { escapeHtml, formatMoney } from "../utils.js";
import { formatNutritionValue } from "../state/nutritionCalculator.js";
import { getFastPurchaseProduct, getPackageQty, getPackageUnit, ingredientHasFastPurchaseData, isTrustedPurchaseEnabled } from "../fastPurchase.js";

const PACKAGING_OPTIONS = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];
const UNIT_OPTIONS = ["g", "kg", "ml", "l", "unidades"];
const NUTRITION_KEYS = ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "salt", "sodium"];

export function renderIngredientCard(state, ingredient, { mode = "manage", shoppingItem = null } = {}) {
  if (mode === "shop") return renderShopCard(state, ingredient, shoppingItem);
  return renderManageCard(state, ingredient);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 3 });
}

function optionList(values, selected) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${String(selected || "") === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function primaryProduct(ingredient) {
  return getFastPurchaseProduct(ingredient) || (ingredient.products || [])[0] || {};
}

function activeNutritionSnapshot(state, ingredient) {
  const activeProduct = (ingredient.products || []).find(product => product.activeNutrition && product.nutritionSnapshot)
    || (ingredient.products || []).find(product => product.nutritionSnapshot);
  if (activeProduct?.nutritionSnapshot) return activeProduct.nutritionSnapshot;
  return state.nutritionProfiles.find(profile => profile.ingredientId === ingredient.id) || null;
}

function renderNutritionDetails(state, ingredient) {
  const snapshot = activeNutritionSnapshot(state, ingredient);
  if (!snapshot) return `<p class="small muted">Sin perfil nutricional activo.</p>`;
  return `
    <div class="mini-facts">
      ${NUTRITION_KEYS.map(key => `<span>${escapeHtml(key)}: ${escapeHtml(formatNutritionValue(key, snapshot[key]))}</span>`).join("")}
    </div>
    <p class="small muted">Base: ${escapeHtml(String(snapshot.per || 100))} ${escapeHtml(snapshot.unit || ingredient.unit || "g")}${snapshot.source ? ` · ${escapeHtml(snapshot.source)}` : ""}</p>
  `;
}

function latestPackageInfo(state, ingredient) {
  const lots = (state.purchaseLots || [])
    .filter(lot => lot.ingredientId === ingredient.id && Number(lot.packageCount) > 0 && Number(lot.packageSizeQty) > 0)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const lot = lots[0];
  if (lot) return `${formatNumber(lot.packageCount)} envase(s) × ${formatNumber(lot.packageSizeQty)} ${lot.packageSizeUnit || lot.unit} = ${formatNumber(lot.qty)} ${lot.unit}`;

  const product = primaryProduct(ingredient);
  const packageQty = getPackageQty(product);
  if (!packageQty) return "";
  const count = Number(product.packageCount || 1);
  const total = Number(product.lastPurchasedQty || (packageQty * count));
  const packageUnit = getPackageUnit(product) || ingredient.unit;
  return `${formatNumber(count)} envase(s) × ${formatNumber(packageQty)} ${packageUnit} = ${formatNumber(total)} ${product.lastPurchasedUnit || packageUnit || ingredient.unit}`;
}

function latestPriceInfo(state, ingredient) {
  const lots = (state.purchaseLots || [])
    .filter(lot => lot.ingredientId === ingredient.id && Number(lot.price) > 0)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const source = lots[0] || primaryProduct(ingredient);
  if (!Number(source?.price || 0)) return null;
  const rawSource = String(source.priceSourceLabel || source.priceSource || source.source || "manual");
  const isOpenPrices = rawSource.toLowerCase().includes("open-prices") || rawSource.toLowerCase().includes("open prices");
  return {
    price: Number(source.price),
    source: isOpenPrices ? "manual/local" : rawSource,
    date: isOpenPrices ? "" : source.priceDate || "",
    store: isOpenPrices ? "" : source.priceStoreName || ""
  };
}

function renderPriceInfo(state, ingredient) {
  const info = latestPriceInfo(state, ingredient);
  if (!info) return "";
  const details = [info.source, info.store, info.date].filter(Boolean).join(" · ");
  return `
    <div class="item small price-source-card">
      <strong>Precio ${formatMoney(info.price)}</strong>
      <p class="qty-line">${escapeHtml(details || "manual/local")}</p>
    </div>`;
}

function renderFastPurchasePanel(ingredient) {
  const product = primaryProduct(ingredient);
  const enabled = isTrustedPurchaseEnabled(ingredient);
  const packageQty = getPackageQty(product) || "";
  const packageUnit = getPackageUnit(product) || ingredient.unit || "g";
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

function renderManageCard(state, ingredient) {
  const family = state.ingredientFamilies.find(f => f.id === ingredient.familyId)?.name || "Sin familia";
  const nutrition = state.nutritionProfiles.find(n => n.ingredientId === ingredient.id);
  const productCount = (ingredient.products || []).length;
  const fastReady = ingredientHasFastPurchaseData(ingredient);
  const fastEnabled = isTrustedPurchaseEnabled(ingredient);
  const productText = (ingredient.products || []).map(p => [p.productName, p.brand, p.barcode, p.packagingType, p.packaging, p.packageQty, p.packageUnit].filter(Boolean).join(" ")).join(" ");
  const packaging = ingredient.packagingType || ingredient.products?.find(p => p.packagingType || p.packaging)?.packagingType || ingredient.products?.find(p => p.packaging)?.packaging || "sin envase";
  const packageInfo = latestPackageInfo(state, ingredient);
  const priceInfo = latestPriceInfo(state, ingredient);
  const searchText = [ingredient.name, family, ingredient.qty, ingredient.unit, packageInfo, priceInfo?.source, priceInfo?.price, ingredient.expiryDate || "sin fecha", ingredient.storageType, packaging, nutrition ? "nutrición sí" : "nutrición pendiente", fastEnabled ? "compra rápida confianza" : "compra normal", productText].join(" ");
  return `
    <div class="item ingredient-item" data-ingredient-id="${escapeHtml(ingredient.id)}" data-search="${escapeHtml(searchText)}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(ingredient.name)}</strong>
          <p class="qty-line">Stock total: ${formatNumber(ingredient.qty)} ${escapeHtml(ingredient.unit)} · ${escapeHtml(family)}</p>
          ${packageInfo ? `<p class="small muted">Última compra/envase: ${escapeHtml(packageInfo)}</p>` : ""}
        </div>
        ${ingredient.expiryDate ? `<span class="badge warning">${escapeHtml(ingredient.expiryDate)}</span>` : `<span class="badge">sin fecha</span>`}
      </div>
      <div class="mini-facts">
        <span>Productos asociados: ${productCount}</span>
        <span>Nutrición: ${nutrition ? "sí" : "pendiente"}</span>
        <span>Envase: ${escapeHtml(packaging)}</span>
        <span>Compra rápida: ${fastEnabled ? "activa" : "no"}${fastReady ? "" : " · incompleta"}</span>
      </div>
      ${renderPriceInfo(state, ingredient)}
      ${renderFastPurchasePanel(ingredient)}
      <details>
        <summary>Ver nutrición activa</summary>
        ${renderNutritionDetails(state, ingredient)}
      </details>
      <div class="row-actions wrap">
        <button class="secondary" data-action="open-ingredient-detail" data-ingredient-id="${escapeHtml(ingredient.id)}">Ver ficha</button>
        <button class="secondary" data-action="edit-stock" data-ingredient-id="${escapeHtml(ingredient.id)}">Editar stock</button>
        <button class="secondary" data-action="open-waste-modal" data-ingredient-id="${escapeHtml(ingredient.id)}">Tirar</button>
        <button class="danger" data-action="delete-ingredient" data-ingredient-id="${escapeHtml(ingredient.id)}">Eliminar</button>
      </div>
    </div>`;
}

function renderShopCard(state, ingredient, item) {
  const icon = item.status === "done" ? "✓" : item.status === "partial" ? "◐" : item.status === "skipped" ? "–" : "☐";
  const fastIcon = item.fastPurchase ? "⚡ " : "";
  const statusText = item.status === "done"
    ? "Comprado completo"
    : item.status === "partial"
      ? `Necesario: ${item.display.missing} · Comprado: ${item.display.purchased} · Falta: ${item.display.remaining}`
      : item.status === "skipped"
        ? `Omitido en esta compra · Necesario originalmente: ${item.display.missing}`
        : `Faltan: ${item.display.missing} · Tengo: ${item.display.stock}`;
  const badgeClass = item.status === "partial" || item.status === "skipped" ? "warning" : "";
  const priceInfo = latestPriceInfo(state, ingredient);
  const searchText = [item.name, item.family, item.zone, item.status, statusLabel(item.status), statusText, item.display?.missing, item.display?.stock, item.display?.remaining, item.fastPurchase ? "compra rápida" : "", priceInfo?.source, priceInfo?.price].join(" ");
  return `
    <article class="item shopping-item supermarket-item ${escapeHtml(item.status)}" data-search="${escapeHtml(searchText)}">
      <div>
        <div class="item-title"><strong>${icon} ${escapeHtml(item.name)}</strong><span class="badge ${badgeClass}">${escapeHtml(statusLabel(item.status))}</span></div>
        <p class="qty-line">${statusText}</p>
        ${priceInfo ? `<p class="small muted">Precio guardado: ${formatMoney(priceInfo.price)} · ${escapeHtml(priceInfo.source || "manual")}</p>` : ""}
      </div>
      <details>
        <summary>Ver nutrición</summary>
        ${renderNutritionDetails(state, ingredient)}
      </details>
      <div class="row-actions no-print supermarket-actions">
        ${item.status !== "done" && item.status !== "skipped" ? `
          <button data-action="scan-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">${fastIcon}Escanear</button>
          <button class="secondary" data-action="manual-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">${fastIcon}Añadir manual</button>
          <button class="ghost" data-action="skip-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">No comprar</button>` : ""}
        ${item.status === "done" ? `<button class="secondary" data-action="manual-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">${fastIcon}Añadir más</button>` : ""}
        ${item.status === "skipped" ? `<button class="secondary" data-action="reopen-shopping-item" data-ingredient-id="${escapeHtml(item.ingredientId)}">Reactivar</button>` : ""}
      </div>
    </article>`;
}

function statusLabel(status) {
  if (status === "done") return "comprado";
  if (status === "partial") return "parcial";
  if (status === "skipped") return "no comprar";
  return "pendiente";
}
