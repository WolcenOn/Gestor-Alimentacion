import { mergePackIntoState, normalizePack } from "./packLoader.js";

const CANONICAL_PACK_INGREDIENTS = Object.freeze({
  "ajo": ["ajo", "Ajo"],
  "cebolla": ["cebolla", "Cebolla"],
  "puerro": ["puerro", "Puerro"],
  "tomate": ["tomate", "Tomate"],
  "tomates": ["tomate", "Tomate"],
  "tomate cherry": ["tomate", "Tomate"],
  "tomates cherry": ["tomate", "Tomate"],
  "pimiento": ["pimiento", "Pimiento"],
  "pimiento rojo": ["pimiento", "Pimiento"],
  "pimiento rojo crudo": ["pimiento", "Pimiento"],
  "pimiento verde": ["pimiento", "Pimiento"],
  "pepino": ["pepino", "Pepino"],
  "brocoli": ["brocoli", "Brócoli"],
  "coliflor": ["coliflor", "Coliflor"],
  "judias verdes": ["judias_verdes", "Judías verdes"],
  "lechuga": ["lechuga", "Lechuga"],
  "espinaca": ["espinaca", "Espinaca"],
  "espinacas": ["espinaca", "Espinaca"],
  "brotes tiernos": ["brotes_tiernos", "Brotes tiernos"],
  "calabacin": ["calabacin", "Calabacín"],
  "calabaza": ["calabaza", "Calabaza"],
  "berenjena": ["berenjena", "Berenjena"],
  "patata": ["patata", "Patata"],
  "patatas": ["patata", "Patata"],
  "zanahoria": ["zanahoria", "Zanahoria"],
  "zanahorias": ["zanahoria", "Zanahoria"],
  "champinon": ["champinon", "Champiñón"],
  "champinones": ["champinon", "Champiñón"],
  "seta": ["seta", "Seta"],
  "setas": ["seta", "Seta"],
  "arroz redondo": ["arroz_redondo", "Arroz redondo"],
  "arroz extra": ["arroz_extra", "Arroz extra"],
  "arroz vaporizado": ["arroz_vaporizado", "Arroz vaporizado"],
  "arroz basmati": ["arroz_basmati", "Arroz basmati"],
  "arroz integral": ["arroz_integral", "Arroz integral"],
  "leche entera": ["leche_entera", "Leche entera"],
  "leche semidesnatada": ["leche_semidesnatada", "Leche semidesnatada"],
  "leche desnatada": ["leche_desnatada", "Leche desnatada"],
  "leche entera sin lactosa": ["leche_entera_sin_lactosa", "Leche entera sin lactosa"],
  "leche semidesnatada sin lactosa": ["leche_semidesnatada_sin_lactosa", "Leche semidesnatada sin lactosa"],
  "leche desnatada sin lactosa": ["leche_desnatada_sin_lactosa", "Leche desnatada sin lactosa"]
});

export function canonicalForPackIngredient(ingredient) {
  const match = CANONICAL_PACK_INGREDIENTS[normalizeLookup(ingredient?.name || "")];
  return match ? { id: match[0], name: match[1] } : null;
}

export function adaptCanonicalReadyPack(inputPack) {
  const source = clone(inputPack);
  const originalPackId = String(source.id || slug(source.name || "pack"));
  source.id = `${originalPackId}_canonical`;
  source.name = `${String(source.name || "Pack sin nombre")} · Canonical`;
  source.tags = [...new Set([...(Array.isArray(source.tags) ? source.tags : []), "canonical", "prices-api"])];
  source.ingredients = (Array.isArray(source.ingredients) ? source.ingredients : []).map(ingredient => {
    const canonical = canonicalForPackIngredient(ingredient);
    if (!canonical) return ingredient;
    return {
      ...ingredient,
      canonicalIngredientId: canonical.id,
      canonicalIngredientName: canonical.name,
      canonicalMatchStatus: "confirmed"
    };
  });
  source.dishes = (Array.isArray(source.dishes) ? source.dishes : []).map(dish => ({
    ...dish,
    id: `${String(dish.id || slug(dish.name || "dish"))}_canonical`,
    packId: source.id
  }));
  return source;
}

export function normalizeCanonicalReadyPack(inputPack) {
  const adapted = adaptCanonicalReadyPack(inputPack);
  const normalized = normalizePack(adapted);
  const linksById = new Map(adapted.ingredients.map(ingredient => [ingredient.id, ingredient]));
  normalized.ingredients = normalized.ingredients.map(ingredient => {
    const source = linksById.get(ingredient.id);
    if (!source?.canonicalIngredientId) return ingredient;
    return {
      ...ingredient,
      canonicalIngredientId: source.canonicalIngredientId,
      canonicalIngredientName: source.canonicalIngredientName || "",
      canonicalMatchStatus: source.canonicalMatchStatus || "confirmed"
    };
  });
  return normalized;
}

export function mergeCanonicalPackIntoState(state, pack, options = {}) {
  mergePackIntoState(state, pack, options);
  const canonicalIngredients = (pack?.ingredients || []).filter(ingredient => ingredient?.canonicalIngredientId);
  for (const incoming of canonicalIngredients) {
    const existing = (state.ingredients || []).find(ingredient => ingredient.id === incoming.id)
      || (state.ingredients || []).find(ingredient => ingredient.canonicalIngredientId === incoming.canonicalIngredientId);
    if (!existing || existing.canonicalIngredientId) continue;
    existing.canonicalIngredientId = incoming.canonicalIngredientId;
    existing.canonicalIngredientName = incoming.canonicalIngredientName || incoming.name || "";
    existing.canonicalMatchStatus = incoming.canonicalMatchStatus || "confirmed";
    existing.updatedAt = new Date().toISOString();
  }
}

function normalizeLookup(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function slug(value) {
  return String(value || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}
