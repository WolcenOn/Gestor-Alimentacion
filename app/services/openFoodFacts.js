const CACHE_KEY = "gestorMenuSemanal.openFoodFacts.cache.v2";

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function setCache(cache) { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }

function normalizeProduct(barcode, p = {}) {
  const nutriments = p.nutriments || {};
  return {
    barcode: String(barcode || p.code || ""),
    productName: p.product_name || p.product_name_es || p.generic_name || "Producto sin nombre",
    brand: p.brands || "",
    quantity: p.quantity || "",
    packageQty: Number(p.product_quantity) || extractQtyFromQuantity(p.quantity).qty || 0,
    packageUnit: p.product_quantity_unit || extractQtyFromQuantity(p.quantity).unit || "g",
    imageUrl: p.image_url || p.image_front_url || "",
    nutriments,
    nutriscore: p.nutriscore_grade || p.nutrition_grades || "",
    categories: p.categories || "",
    packaging: p.packaging || "",
    source: "openfoodfacts"
  };
}

function extractQtyFromQuantity(quantity = "") {
  const match = String(quantity).toLowerCase().replace(",", ".").match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|g|ml|l|cl|unidad|unidades|ud|uds)/);
  if (!match) return { qty: 0, unit: "" };
  let qty = Number(match[1]);
  let unit = match[2];
  if (unit === "kg") { qty *= 1000; unit = "g"; }
  if (unit === "l") { qty *= 1000; unit = "ml"; }
  if (unit === "cl") { qty *= 10; unit = "ml"; }
  if (["unidad", "ud", "uds"].includes(unit)) unit = "unidades";
  return { qty, unit };
}

export function nutritionProfileFromOpenFoodFacts(product, ingredientId) {
  const n = product?.nutriments || {};
  return {
    ingredientId,
    per: 100,
    unit: "g",
    kcal: Number(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) || 0,
    carbs: Number(n.carbohydrates_100g ?? 0) || 0,
    protein: Number(n.proteins_100g ?? 0) || 0,
    fat: Number(n.fat_100g ?? 0) || 0,
    fiber: Number(n.fiber_100g ?? 0) || 0,
    sugar: Number(n.sugars_100g ?? 0) || 0,
    sodium: Number(n.sodium_100g ?? 0) || 0,
    source: "openfoodfacts"
  };
}

export async function lookupOpenFoodFacts(barcode) {
  if (!/^\d{6,18}$/.test(String(barcode))) throw new Error("Código de barras no válido.");
  const cache = getCache();
  if (cache[`barcode:${barcode}`]) return cache[`barcode:${barcode}`];
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_es,generic_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,nutriscore_grade,nutrition_grades,image_url,image_front_url,categories,packaging`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo consultar Open Food Facts.");
  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;
  const normalized = normalizeProduct(barcode, data.product);
  cache[`barcode:${barcode}`] = normalized;
  setCache(cache);
  return normalized;
}

export async function searchOpenFoodFacts(query) {
  const q = String(query || "").trim();
  if (q.length < 2) throw new Error("Escribe al menos 2 caracteres para buscar en Open Food Facts.");
  const cache = getCache();
  if (cache[`search:${q.toLowerCase()}`]) return cache[`search:${q.toLowerCase()}`];
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "12");
  url.searchParams.set("fields", "code,product_name,product_name_es,generic_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,nutriscore_grade,nutrition_grades,image_url,image_front_url,categories,packaging");
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo buscar en Open Food Facts.");
  const data = await response.json();
  const products = (data.products || []).filter(p => p.code).map(p => normalizeProduct(p.code, p));
  cache[`search:${q.toLowerCase()}`] = products;
  setCache(cache);
  return products;
}
