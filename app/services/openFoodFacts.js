const CACHE_KEY = "gestorMenuSemanal.openFoodFacts.cache.v1";

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function setCache(cache) { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }

export async function lookupOpenFoodFacts(barcode) {
  if (!/^\d{6,18}$/.test(String(barcode))) throw new Error("Código de barras no válido.");
  const cache = getCache();
  if (cache[barcode]) return cache[barcode];
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,nutriscore_grade,image_url`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo consultar Open Food Facts.");
  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const normalized = {
    barcode,
    productName: p.product_name || "Producto sin nombre",
    brand: p.brands || "",
    quantity: p.quantity || "",
    packageQty: Number(p.product_quantity) || 0,
    packageUnit: p.product_quantity_unit || "g",
    imageUrl: p.image_url || "",
    nutriments: p.nutriments || {},
    nutriscore: p.nutriscore_grade || "",
    source: "openfoodfacts"
  };
  cache[barcode] = normalized;
  setCache(cache);
  return normalized;
}
