const DEFAULT_TIMEOUT_MS = 10000;

function runtimeConfig() {
  return window.APP_CONFIG || window.GESTOR_APP_CONFIG || {};
}

export function getPricesApiBaseUrl() {
  return String(runtimeConfig().PRICES_API_BASE_URL || "").trim().replace(/\/+$/, "");
}

export function getPricesPostalCode() {
  return String(runtimeConfig().PRICES_POSTAL_CODE || "28001").trim();
}

export function isPricesApiConfigured() {
  return Boolean(getPricesApiBaseUrl());
}

export function buildIngredientProductsUrl({ baseUrl, ingredientId, postalCode }) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  const id = String(ingredientId || "").trim();
  if (!base) throw new Error("Prices API no configurada.");
  if (!id) throw new Error("Falta canonicalIngredientId.");

  const params = new URLSearchParams();
  const postal = String(postalCode || "").trim();
  if (postal) params.set("postalCode", postal);
  const query = params.toString();
  return `${base}/ingredients/${encodeURIComponent(id)}/products${query ? `?${query}` : ""}`;
}

export function pickBestIngredientProduct(items = []) {
  const candidates = (Array.isArray(items) ? items : [])
    .filter(item => item?.product && item.product.available !== false && Number(item.product.price) > 0);
  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const aUnit = Number(a.product.pricePerUnit) > 0 ? Number(a.product.pricePerUnit) : Number(a.product.price);
    const bUnit = Number(b.product.pricePerUnit) > 0 ? Number(b.product.pricePerUnit) : Number(b.product.price);
    if (aUnit !== bUnit) return aUnit - bUnit;
    const aPrice = Number(a.product.price);
    const bPrice = Number(b.product.price);
    if (aPrice !== bPrice) return aPrice - bPrice;
    return String(a.product.name || "").localeCompare(String(b.product.name || ""), "es");
  })[0];
}

async function getJSON(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || `Prices API respondió ${response.status}.`);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("La consulta de precios ha tardado demasiado.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getCanonicalIngredientProducts({ ingredientId, postalCode = getPricesPostalCode(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = buildIngredientProductsUrl({
    baseUrl: getPricesApiBaseUrl(),
    ingredientId,
    postalCode
  });
  return getJSON(url, timeoutMs);
}

export function buildIngredientQuoteUrl({ baseUrl, ingredientId, amount, unit, postalCode }) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  const id = String(ingredientId || "").trim();
  const qty = Number(amount);
  const normalizedUnit = String(unit || "").trim();
  if (!base) throw new Error("Prices API no configurada.");
  if (!id) throw new Error("Falta canonicalIngredientId.");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Cantidad de cotización inválida.");
  if (!normalizedUnit) throw new Error("Unidad de cotización inválida.");

  const params = new URLSearchParams({
    amount: String(qty),
    unit: normalizedUnit
  });
  const postal = String(postalCode || "").trim();
  if (postal) params.set("postalCode", postal);
  return `${base}/ingredients/${encodeURIComponent(id)}/quote?${params.toString()}`;
}

export async function quoteCanonicalIngredient({ ingredientId, amount, unit, postalCode = getPricesPostalCode(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = buildIngredientQuoteUrl({
    baseUrl: getPricesApiBaseUrl(),
    ingredientId,
    amount,
    unit,
    postalCode
  });
  return getJSON(url, timeoutMs);
}
