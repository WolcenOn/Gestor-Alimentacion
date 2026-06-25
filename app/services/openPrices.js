const OPEN_PRICES_BASE = "https://prices.openfoodfacts.org";
const CACHE_KEY = "gestorMenuSemanal.openPrices.cache.v1";

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function setCache(cache) { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeLocation(price = {}) {
  return price.location_osm_name
    || price.location?.osm_name
    || price.location?.name
    || price.shop_name
    || price.store_name
    || price.owner
    || "";
}

function normalizeOpenPrice(raw = {}) {
  const amount = Number(raw.price ?? raw.price_value ?? raw.value ?? 0) || 0;
  if (!amount) return null;
  return {
    price: amount,
    currency: raw.currency || raw.price_currency || "EUR",
    source: "open-prices",
    sourceLabel: "Open Prices",
    date: raw.date || raw.price_date || raw.created || raw.created_at || "",
    location: normalizeLocation(raw),
    proofId: raw.proof_id || raw.proof?.id || "",
    priceId: raw.id || "",
    productCode: raw.product_code || raw.code || raw.barcode || "",
    fetchedAt: new Date().toISOString(),
    url: `${OPEN_PRICES_BASE}/app/product/${encodeURIComponent(raw.product_code || raw.code || raw.barcode || "")}`
  };
}

function chooseBestPrice(prices = []) {
  return prices
    .map(normalizeOpenPrice)
    .filter(Boolean)
    .filter(price => !price.currency || price.currency === "EUR")
    .sort((a, b) => String(b.date || b.fetchedAt).localeCompare(String(a.date || a.fetchedAt)))[0] || null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo consultar Open Prices.");
  return response.json();
}

export async function lookupOpenPriceByBarcode(barcode) {
  const code = String(barcode || "").trim();
  if (!/^\d{6,18}$/.test(code)) return null;

  const cache = getCache();
  const key = `barcode:${code}`;
  const cached = cache[key];
  if (cached && Date.now() - Number(cached.cachedAt || 0) < 24 * 60 * 60 * 1000) return cached.price || null;

  const attempts = [
    `${OPEN_PRICES_BASE}/api/v1/prices?product_code=${encodeURIComponent(code)}`,
    `${OPEN_PRICES_BASE}/api/v1/prices?code=${encodeURIComponent(code)}`,
    `${OPEN_PRICES_BASE}/api/v1/prices?product_code__eq=${encodeURIComponent(code)}`
  ];

  for (const url of attempts) {
    try {
      const payload = await fetchJson(url);
      const price = chooseBestPrice(asArray(payload));
      if (price) {
        const result = { ...price, productCode: price.productCode || code, url: `${OPEN_PRICES_BASE}/app/product/${encodeURIComponent(code)}` };
        cache[key] = { cachedAt: Date.now(), price: result };
        setCache(cache);
        return result;
      }
    } catch (error) {
      console.warn("Open Prices lookup failed", error);
    }
  }

  cache[key] = { cachedAt: Date.now(), price: null };
  setCache(cache);
  return null;
}

export function getOpenPricesContributionUrl(barcode = "") {
  const code = String(barcode || "").trim();
  return code
    ? `${OPEN_PRICES_BASE}/app/product/${encodeURIComponent(code)}`
    : `${OPEN_PRICES_BASE}/app`;
}
