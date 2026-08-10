import { cacheFood, cacheSearch, getCachedSearch, cacheKey } from "./foodCache.js";

const CACHE_KEY = "gestorMenuSemanal.openFoodFacts.cache.v3";

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function setCache(cache) { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }

const LOCALIZED_NAME_FIELDS = ["product_name", "generic_name", "abbreviated_product_name"];

function localizedValue(product = {}, base, lang = "es") {
  return product[`${base}_${lang}`] || product[base] || product[`${base}_es`] || product[`${base}_en`] || "";
}

function firstNonEmpty(...values) {
  return values.find(value => String(value || "").trim()) || "";
}

function normalizeProduct(barcode, p = {}, lang = "es") {
  const nutriments = p.nutriments || {};
  const quantity = p.quantity || "";
  const extracted = extractQtyFromQuantity(quantity);
  const declaredPackage = normalizePackageQuantity(p.product_quantity, p.product_quantity_unit);
  const declaredServing = normalizePackageQuantity(p.serving_quantity, p.serving_quantity_unit);
  const productName = firstNonEmpty(
    ...LOCALIZED_NAME_FIELDS.map(field => localizedValue(p, field, lang)),
    p.product_name,
    p.generic_name,
    "Producto sin nombre"
  );
  const packageQty = declaredPackage.qty || extracted.qty || declaredServing.qty || 0;
  const packageUnit = declaredPackage.unit || extracted.unit || declaredServing.unit || "g";

  return {
    id: String(barcode || p.code || ""),
    barcode: String(barcode || p.code || ""),
    productName,
    genericName: firstNonEmpty(localizedValue(p, "generic_name", lang), p.generic_name),
    brand: p.brands || "",
    quantity,
    packageQty,
    packageUnit,
    servingQty: declaredServing.qty || 0,
    servingUnit: declaredServing.unit || "g",
    imageUrl: p.image_url || p.image_front_url || "",
    nutriments,
    nutriscore: p.nutriscore_grade || p.nutrition_grades || "",
    novaGroup: p.nova_group || "",
    ecoscore: p.ecoscore_grade || "",
    categories: p.categories || "",
    categoriesTags: p.categories_tags || [],
    labels: p.labels || "",
    labelsTags: p.labels_tags || [],
    allergens: p.allergens || "",
    allergensTags: p.allergens_tags || [],
    ingredientsText: localizedValue(p, "ingredients_text", lang) || p.ingredients_text || "",
    packaging: p.packaging || p.packaging_text || "",
    packagingText: p.packaging_text || p.packaging || "",
    packagingType: inferPackagingType(p.packaging || p.packaging_text || ""),
    lang,
    source: "openfoodfacts",
    rawImportedAt: new Date().toISOString()
  };
}

function inferPackagingType(packaging = "") {
  const value = String(packaging).toLowerCase();
  if (/vidrio|glass|bocal|jar/.test(value)) return "vidrio";
  if (/cart[oó]n|paper|papel|cardboard|box/.test(value)) return "cartón/papel";
  if (/metal|aluminio|aluminium|steel|lata|can/.test(value)) return "metal";
  if (/brik|tetra/.test(value)) return "brik";
  if (/pl[aá]stico|plastic|pet|film|bolsa|bag/.test(value)) return "plástico";
  return "otro";
}

function normalizeOffUnit(unit = "") {
  const value = String(unit || "").toLowerCase().trim();
  if (["kg", "g", "ml", "l"].includes(value)) return value;
  if (["cl"].includes(value)) return "ml";
  if (["unidad", "unidades", "ud", "uds", "piece", "pieces"].includes(value)) return "unidades";
  return value || "g";
}

function normalizePackageQuantity(qty, unit = "") {
  let amount = Number(qty) || 0;
  let normalizedUnit = normalizeOffUnit(unit || "");
  const rawUnit = String(unit || "").toLowerCase().trim();
  if (!amount) return { qty: 0, unit: normalizedUnit || "" };
  if (rawUnit === "kg") { amount *= 1000; normalizedUnit = "g"; }
  if (rawUnit === "l") { amount *= 1000; normalizedUnit = "ml"; }
  if (rawUnit === "cl") { amount *= 10; normalizedUnit = "ml"; }
  return { qty: amount, unit: normalizedUnit };
}

function extractQtyFromQuantity(quantity = "") {
  const match = String(quantity).toLowerCase().replace(",", ".").match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|g|ml|l|cl|unidad|unidades|ud|uds)/);
  if (!match) return { qty: 0, unit: "" };
  return normalizePackageQuantity(match[1], match[2]);
}

export function nutritionProfileFromOpenFoodFacts(product, ingredientId) {
  const n = product?.nutriments || {};
  const carbs = Number(n.carbohydrates_100g ?? 0) || 0;
  const sugar = Math.min(Number(n.sugars_100g ?? 0) || 0, carbs);
  return {
    ingredientId,
    per: 100,
    unit: "g",
    kcal: Number(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) || 0,
    carbs,
    complexCarbs: Math.max(0, carbs - sugar),
    protein: Number(n.proteins_100g ?? 0) || 0,
    fat: Number(n.fat_100g ?? 0) || 0,
    saturatedFat: Number(n["saturated-fat_100g"] ?? 0) || 0,
    fiber: Number(n.fiber_100g ?? 0) || 0,
    sugar,
    salt: Number(n.salt_100g ?? 0) || 0,
    sodium: Number(n.sodium_100g ?? 0) || 0,
    source: "openfoodfacts",
    sourceId: product?.barcode || "",
    sourceName: product?.productName || ""
  };
}

const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "product_name_en",
  "product_name_fr",
  "product_name_ca",
  "generic_name",
  "generic_name_es",
  "generic_name_en",
  "abbreviated_product_name",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "serving_quantity",
  "serving_quantity_unit",
  "nutriments",
  "nutriscore_grade",
  "nutrition_grades",
  "nova_group",
  "ecoscore_grade",
  "image_url",
  "image_front_url",
  "categories",
  "categories_tags",
  "labels",
  "labels_tags",
  "allergens",
  "allergens_tags",
  "ingredients_text",
  "ingredients_text_es",
  "ingredients_text_en",
  "packaging",
  "packaging_text"
].join(",");

export async function lookupOpenFoodFacts(barcode, { lang = "es" } = {}) {
  if (!/^\d{6,18}$/.test(String(barcode))) throw new Error("Código de barras no válido.");
  const cache = getCache();
  const key = `barcode:${lang}:${barcode}`;
  if (cache[key]) return cache[key];
  const cached = await getCachedSearch(cacheKey("off-barcode", lang, barcode));
  if (cached?.[0]) return cached[0];
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(OFF_FIELDS)}`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo consultar Open Food Facts.");
  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;
  const normalized = normalizeProduct(barcode, data.product, lang);
  cache[key] = normalized;
  setCache(cache);
  await cacheFood(normalized);
  await cacheSearch(cacheKey("off-barcode", lang, barcode), [normalized.id]);
  return normalized;
}

export async function searchOpenFoodFacts(query, { lang = "es" } = {}) {
  const q = String(query || "").trim();
  if (q.length < 2) throw new Error("Escribe al menos 2 caracteres para buscar en Open Food Facts.");
  const cache = getCache();
  const key = `search:${lang}:${q.toLowerCase()}`;
  if (cache[key]) return cache[key];
  const idbKey = cacheKey("off-search", lang, q);
  const cached = await getCachedSearch(idbKey);
  if (cached?.length) return cached;
  const hostname = /^[a-z]{2,3}$/.test(lang) ? `${lang}.openfoodfacts.org` : "world.openfoodfacts.org";
  const url = new URL(`https://${hostname}/cgi/search.pl`);
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "12");
  url.searchParams.set("fields", OFF_FIELDS);
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo buscar en Open Food Facts.");
  const data = await response.json();
  const products = (data.products || []).filter(p => p.code).map(p => normalizeProduct(p.code, p, lang));
  cache[key] = products;
  setCache(cache);
  await Promise.all(products.map(product => cacheFood(product)));
  await cacheSearch(idbKey, products.map(product => product.id));
  return products;
}
