import { getState, updateState } from "./store.js";
import { formToObject, closeModal, showAlert, getSubmitterValue } from "./render/ui.js";
import { parseNumber, normalizeUnit, stripDangerousText, formatMoney } from "./utils.js";
import { computeShoppingListWithProgress } from "./state/shoppingProgress.js";
import { registerPurchase } from "./state/stock.js";
import { lookupOpenPriceByBarcode, getOpenPricesContributionUrl } from "./services/openPrices.js";

function ensureHidden(form, name, value = "") {
  let input = form.elements[name];
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    form.append(input);
  }
  input.value = value;
  return input;
}

function ensurePriceHint(form) {
  let hint = form.querySelector("[data-open-prices-hint]");
  if (!hint) {
    hint = document.createElement("div");
    hint.dataset.openPricesHint = "true";
    hint.className = "item small price-source-card";
    form.querySelector(".actions")?.before(hint) || form.append(hint);
  }
  return hint;
}

function applyOpenPriceToForm(form, price) {
  if (!form || !price?.price) return;
  const priceField = form.elements.price;
  if (priceField && !Number(priceField.value || 0)) priceField.value = Number(price.price).toFixed(2);
  ensureHidden(form, "priceSource", "open-prices");
  ensureHidden(form, "priceSourceLabel", "Open Prices");
  ensureHidden(form, "priceDate", price.date || "");
  ensureHidden(form, "priceStoreName", price.location || "");
  ensureHidden(form, "openPricesUrl", price.url || getOpenPricesContributionUrl(form.elements.barcode?.value));

  const hint = ensurePriceHint(form);
  const sourceDetails = [price.location, price.date].filter(Boolean).join(" · ");
  hint.innerHTML = `<strong>Precio sugerido por Open Prices: ${formatMoney(price.price)}</strong><p class="qty-line">${sourceDetails ? sourceDetails : "Sin tienda/fecha asociada"}. Si tu ticket tiene un precio mejor, corrígelo aquí y puedes actualizarlo en Open Prices.</p>`;
  addOpenPricesButton(form);
}

function addOpenPricesButton(form) {
  if (!form?.matches?.('form[data-form="purchase"]')) return;
  if (form.querySelector('[data-action="open-open-prices"]')) return;
  const barcode = form.elements.barcode?.value || "";
  const actions = form.querySelector(".actions");
  if (!actions) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.dataset.action = "open-open-prices";
  button.dataset.barcode = barcode;
  button.textContent = "Actualizar en Open Prices";
  actions.append(button);
}

async function enrichFormWithOpenPrices(form) {
  if (!form?.matches?.('form[data-form="purchase"]')) return;
  const barcode = String(form.elements.barcode?.value || "").trim();
  if (!/^\d{6,18}$/.test(barcode) || form.dataset.openPricesChecked === barcode) return;
  form.dataset.openPricesChecked = barcode;
  const price = await lookupOpenPriceByBarcode(barcode);
  if (price) applyOpenPriceToForm(form, price);
  else addOpenPricesButton(form);
}

function watchForm(form) {
  if (!form || form.dataset.openPricesWatcher === "true") return;
  form.dataset.openPricesWatcher = "true";
  enrichFormWithOpenPrices(form).catch(error => console.warn(error));
}

function scanOpenPriceForms(root = document) {
  root.querySelectorAll?.('form[data-form="purchase"]').forEach(watchForm);
}

function saveOpenPricesPurchase(form, event) {
  const data = formToObject(form);
  if (data.priceSource !== "open-prices") return false;

  const mode = getSubmitterValue(event, "purchaseMode");
  const state = getState();
  const item = computeShoppingListWithProgress(state).find(i => i.ingredientId === form.dataset.ingredientId);
  const isFastPurchase = form.dataset.fastPurchase === "true";
  let purchasedQty = parseNumber(data.purchasedQty);
  if (!isFastPurchase && mode === "complete" && item?.remainingQty) purchasedQty = item.remainingQty;

  updateState(draft => registerPurchase(draft, {
    ingredientId: form.dataset.ingredientId,
    weekId: draft.activeWeekId,
    requiredQty: parseNumber(form.dataset.requiredQty),
    purchasedQty,
    unit: normalizeUnit(data.unit),
    barcode: data.barcode || "",
    brand: stripDangerousText(data.brand || ""),
    productName: stripDangerousText(data.productName || ""),
    productSource: "open-prices",
    price: parseNumber(data.price),
    priceSource: "open-prices",
    priceSourceLabel: "Open Prices",
    priceDate: data.priceDate || "",
    priceStoreName: stripDangerousText(data.priceStoreName || ""),
    openPricesUrl: data.openPricesUrl || getOpenPricesContributionUrl(data.barcode),
    purchaseDate: data.purchaseDate,
    expiryDate: data.expiryDate,
    dateType: data.dateType,
    storageType: data.storageType,
    isPartial: mode !== "complete",
    source: isFastPurchase ? "shopping-list-fast" : "shopping-list",
    packagingType: data.packagingType || "otro",
    packagingQty: parseNumber(data.packagingQty),
    packageSizeQty: parseNumber(data.packageSizeQty),
    packageSizeUnit: normalizeUnit(data.packageSizeUnit || data.unit)
  }), "purchase-open-prices");

  closeModal();
  showAlert("Compra guardada con precio de Open Prices y stock actualizado.");
  return true;
}

document.addEventListener("input", event => {
  const form = event.target.closest?.('form[data-form="purchase"]');
  if (!form || event.target.name !== "barcode") return;
  form.dataset.openPricesChecked = "";
  enrichFormWithOpenPrices(form).catch(error => console.warn(error));
}, true);

document.addEventListener("click", event => {
  const button = event.target.closest?.('[data-action="open-open-prices"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = button.closest("form");
  const barcode = button.dataset.barcode || form?.elements.barcode?.value || "";
  window.open(getOpenPricesContributionUrl(barcode), "_blank", "noopener,noreferrer");
  showAlert("Abriendo Open Prices para revisar o aportar un precio.");
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest?.('form[data-form="purchase"]');
  if (!form) return;
  try {
    if (saveOpenPricesPurchase(form, event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  } catch (error) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.error(error);
    showAlert(error.message || "No se pudo guardar la compra con precio de Open Prices.", "error");
  }
}, true);

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) mutation.addedNodes.forEach(node => scanOpenPriceForms(node));
});
observer.observe(document.body, { childList: true, subtree: true });
scanOpenPriceForms();

window.GestorOpenPrices = { lookup: lookupOpenPriceByBarcode, contributeUrl: getOpenPricesContributionUrl };
