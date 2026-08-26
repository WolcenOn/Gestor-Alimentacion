import { assertSafePackPath, validatePack } from "../validation.js";
import { normalizeUnit, stripDangerousText } from "../utils.js";
import { findIngredientByCanonicalId, normalizeCanonicalMatchStatus } from "../state/canonicalIngredients.js";

export const PACK_SOURCE = Object.freeze({
  owner: "WolcenOn",
  repo: "Gestor-Alimentacion",
  branch: "main",
  basePath: "packs",
  manifestPath: "packs/manifest.json"
});

const GITHUB_API = "https://api.github.com";
const RAW_GITHUB = "https://raw.githubusercontent.com";

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

export async function listRemotePacks() {
  const manifestUrl = `${GITHUB_API}/repos/${PACK_SOURCE.owner}/${PACK_SOURCE.repo}/contents/${PACK_SOURCE.manifestPath}?ref=${PACK_SOURCE.branch}`;
  const response = await fetch(manifestUrl, {
    cache: "no-store",
    headers: { "Accept": "application/vnd.github+json" }
  });
  if (!response.ok) {
    const detail = response.status === 403
      ? "GitHub ha limitado temporalmente las peticiones. Vuelve a intentarlo en unos minutos."
      : `Respuesta ${response.status} al leer el manifest de packs.`;
    throw new Error(`No se pudieron listar los packs remotos. ${detail}`);
  }
  const payload = await response.json();
  const encoded = String(payload?.content || "").replace(/\s+/g, "");
  let entries = [];
  try {
    entries = JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    throw new Error("El manifest de packs no contiene JSON válido.");
  }
  if (!Array.isArray(entries)) throw new Error("El manifest de packs no es una lista válida.");
  return entries.map(entry => manifestEntryToRemoteFile(entry)).filter(Boolean);
}

function manifestEntryToRemoteFile(entry) {
  const path = String(entry?.path || "").trim();
  if (!path.startsWith(`${PACK_SOURCE.basePath}/`) || path.includes("..") || !path.endsWith(".json")) return null;
  const name = String(entry?.name || path.split("/").pop() || "pack.json").trim();
  return {
    name,
    path,
    title: String(entry?.title || "").trim(),
    description: String(entry?.description || "").trim(),
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    canonicalReady: Boolean(entry?.canonicalReady),
    downloadUrl: `${RAW_GITHUB}/${PACK_SOURCE.owner}/${PACK_SOURCE.repo}/${PACK_SOURCE.branch}/${path}`
  };
}

export async function loadRemotePack(file) {
  const relativePath = file.path.replace(`${PACK_SOURCE.basePath}/`, "");
  assertSafePackPath(relativePath);
  const response = await fetch(file.downloadUrl, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo descargar el pack.");
  const text = await response.text();
  if (/javascript:|<\s*script/gi.test(text)) throw new Error("Pack potencialmente inseguro.");
  const parsed = JSON.parse(text);
  const input = file.canonicalReady || String(file.path || "").startsWith(`${PACK_SOURCE.basePath}/canonical/`)
    ? adaptPackToKnownCanonicals(parsed)
    : parsed;
  const pack = normalizePack(input);
  validatePack(pack);
  return pack;
}

export function adaptPackToKnownCanonicals(inputPack) {
  const pack = structuredCloneSafe(inputPack);
  pack.id = `${String(pack.id || slugId(pack.name || "pack"))}_canonical`;
  pack.name = `${String(pack.name || "Pack sin nombre")} · Canonical`;
  pack.tags = [...new Set([...(Array.isArray(pack.tags) ? pack.tags : []), "canonical", "prices-api"] )];
  pack.ingredients = (Array.isArray(pack.ingredients) ? pack.ingredients : []).map(ingredient => {
    if (String(ingredient?.canonicalIngredientId || "").trim()) return ingredient;
    const canonical = canonicalForPackIngredient(ingredient);
    if (!canonical) return ingredient;
    return {
      ...ingredient,
      canonicalIngredientId: canonical.id,
      canonicalIngredientName: canonical.name,
      canonicalMatchStatus: "confirmed"
    };
  });
  pack.dishes = (Array.isArray(pack.dishes) ? pack.dishes : []).map(dish => ({
    ...dish,
    id: `${String(dish.id || slugId(dish.name || "dish"))}_canonical`,
    packId: pack.id
  }));
  return pack;
}

export function canonicalForPackIngredient(ingredient) {
  const normalized = normalizeCanonicalLookup(ingredient?.name || "");
  const match = CANONICAL_PACK_INGREDIENTS[normalized];
  return match ? { id: match[0], name: match[1] } : null;
}

function normalizeCanonicalLookup(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function normalizePack(inputPack) {
  if (!inputPack || typeof inputPack !== "object") throw new Error("Pack inválido.");
  const pack = {
    schemaVersion: 2,
    type: "meal-pack",
    id: inputPack.id || slugId(inputPack.name || "pack"),
    name: stripDangerousText(inputPack.name || "Pack sin nombre"),
    description: stripDangerousText(inputPack.description || ""),
    tags: Array.isArray(inputPack.tags) ? inputPack.tags.map(t => stripDangerousText(t)).filter(Boolean) : [],
    language: stripDangerousText(inputPack.language || "es"),
    ingredients: Array.isArray(inputPack.ingredients) ? inputPack.ingredients.map(normalizePackIngredient) : [],
    dishes: Array.isArray(inputPack.dishes) ? inputPack.dishes.map(normalizePackDish) : []
  };
  const ingredientIds = new Set(pack.ingredients.map(i => i.id));
  pack.dishes = pack.dishes.map(dish => ({
    ...dish,
    recipe: dish.recipe.filter(line => ingredientIds.has(line.ingredientId))
  }));
  return pack;
}

function normalizePackIngredient(ingredient) {
  const canonicalIngredientId = String(ingredient.canonicalIngredientId || "").trim();
  return {
    id: ingredient.id || slugId(ingredient.name || "ingredient"),
    name: stripDangerousText(ingredient.name || "Ingrediente"),
    familyId: ingredient.familyId || "family_other",
    qty: Number(ingredient.qty) || 0,
    unit: normalizeUnit(ingredient.unit || "g"),
    available: Boolean(ingredient.available),
    storageType: ingredient.storageType || "pantry",
    expiryDate: ingredient.expiryDate || "",
    dateType: ingredient.dateType || "none",
    approxPrice: Number(ingredient.approxPrice) || 0,
    packagingType: ingredient.packagingType || "otro",
    products: Array.isArray(ingredient.products) ? ingredient.products : [],
    canonicalIngredientId,
    canonicalIngredientName: canonicalIngredientId ? stripDangerousText(ingredient.canonicalIngredientName || "") : "",
    canonicalMatchStatus: canonicalIngredientId ? normalizeCanonicalMatchStatus(ingredient.canonicalMatchStatus) : "unlinked",
    createdAt: ingredient.createdAt || new Date().toISOString(),
    updatedAt: ingredient.updatedAt || new Date().toISOString(),
    schemaVersion: 1
  };
}

function normalizePackDish(dish) {
  const originalServings = Math.max(Number(dish.servings || dish.portions || 1), 1);
  const recipe = Array.isArray(dish.recipe) ? dish.recipe.map(line => ({
    ingredientId: line.ingredientId,
    qty: Number(line.qty || 0) / originalServings,
    unit: normalizeUnit(line.unit || "g"),
    note: stripDangerousText(line.note || "")
  })).filter(line => line.ingredientId && line.qty > 0) : [];

  const rawSteps = Array.isArray(dish.instructions)
    ? dish.instructions
    : Array.isArray(dish.steps)
      ? dish.steps
      : String(dish.instructions || dish.elaboration || dish.method || "").split(/\n+/g);

  const instructions = rawSteps.map(s => stripDangerousText(s)).map(s => s.trim()).filter(Boolean);
  if (!instructions.length) instructions.push(...buildFallbackInstructions(dish, recipe));

  return {
    id: dish.id || slugId(dish.name || "dish"),
    name: stripDangerousText(dish.name || "Plato"),
    servings: 1,
    unit: "ración",
    category: stripDangerousText(dish.category || ""),
    tags: Array.isArray(dish.tags) ? dish.tags.map(t => stripDangerousText(t)).filter(Boolean) : [],
    prepTime: stripDangerousText(dish.prepTime || ""),
    difficulty: stripDangerousText(dish.difficulty || ""),
    approxPrice: Number(dish.approxPrice) ? Number(dish.approxPrice) / originalServings : 0,
    notes: stripDangerousText(dish.notes || ""),
    instructions,
    recipe,
    packId: dish.packId || "",
    normalizedToServing: true,
    originalServings,
    createdAt: dish.createdAt || new Date().toISOString(),
    updatedAt: dish.updatedAt || new Date().toISOString(),
    schemaVersion: 1
  };
}

function buildFallbackInstructions(dish, recipe) {
  const name = stripDangerousText(dish.name || "el plato");
  const category = String(dish.category || "").toLowerCase();
  const tags = Array.isArray(dish.tags) ? dish.tags.join(" ").toLowerCase() : "";
  const isSalad = category.includes("ensalada") || tags.includes("ensalada") || name.toLowerCase().includes("ensalada");
  const isCold = isSalad || tags.includes("frío") || tags.includes("fria") || tags.includes("rápido");

  if (isSalad) {
    return [
      "Lava y prepara los ingredientes frescos.",
      "Escurre los ingredientes en conserva si los hay.",
      "Corta los ingredientes en trozos adecuados para una ración.",
      "Mezcla todo en un bol y aliña al gusto antes de servir."
    ];
  }

  if (isCold) {
    return [
      "Prepara y pesa los ingredientes indicados para una ración.",
      "Corta o mezcla los ingredientes según corresponda.",
      "Ajusta el aliño o condimento al gusto y sirve."
    ];
  }

  return [
    "Prepara y pesa los ingredientes indicados para una ración.",
    "Cocina o mezcla los ingredientes según el tipo de receta.",
    "Comprueba el punto, ajusta el condimento y sirve."
  ];
}

export function summarizePack(pack) {
  const normalized = normalizePack(pack);
  return {
    ...normalized,
    totalIngredients: normalized.ingredients.length,
    totalDishes: normalized.dishes.length,
    dishesWithInstructions: normalized.dishes.filter(d => d.instructions?.length).length
  };
}

function backfillCanonicalLink(existingIngredient, incomingIngredient) {
  if (!incomingIngredient?.canonicalIngredientId || existingIngredient?.canonicalIngredientId) return;
  existingIngredient.canonicalIngredientId = incomingIngredient.canonicalIngredientId;
  existingIngredient.canonicalIngredientName = incomingIngredient.canonicalIngredientName || incomingIngredient.name || "";
  existingIngredient.canonicalMatchStatus = incomingIngredient.canonicalMatchStatus || "confirmed";
  existingIngredient.updatedAt = new Date().toISOString();
}

export function mergePackIntoState(state, pack, options = {}) {
  const normalizedPack = normalizePack(pack);
  validatePack(normalizedPack);
  const selectedDishIds = new Set(options.selectedDishIds || normalizedPack.dishes.map(d => d.id));
  const selectedDishes = normalizedPack.dishes.filter(d => selectedDishIds.has(d.id));
  const requiredIngredientIds = new Set(selectedDishes.flatMap(d => d.recipe.map(line => line.ingredientId)));
  const existingIngredientIds = new Set(state.ingredients.map(i => i.id));
  const existingDishIds = new Set(state.dishes.map(d => d.id));
  const ingredientIdMap = new Map();

  for (const ingredient of normalizedPack.ingredients) {
    if (!requiredIngredientIds.has(ingredient.id)) continue;

    const canonicalMatch = ingredient.canonicalIngredientId
      ? findIngredientByCanonicalId(state, ingredient.canonicalIngredientId)
      : null;

    if (canonicalMatch) {
      ingredientIdMap.set(ingredient.id, canonicalMatch.id);
      continue;
    }

    if (existingIngredientIds.has(ingredient.id)) {
      const existingIngredient = state.ingredients.find(item => item.id === ingredient.id);
      if (existingIngredient) backfillCanonicalLink(existingIngredient, ingredient);
      ingredientIdMap.set(ingredient.id, ingredient.id);
      continue;
    }

    state.ingredients.push(ingredient);
    existingIngredientIds.add(ingredient.id);
    ingredientIdMap.set(ingredient.id, ingredient.id);
  }

  const packId = normalizedPack.id || slugId(normalizedPack.name);
  for (const dish of selectedDishes) {
    if (existingDishIds.has(dish.id)) continue;
    state.dishes.push({
      ...dish,
      packId,
      recipe: dish.recipe.map(line => ({
        ...line,
        ingredientId: ingredientIdMap.get(line.ingredientId) || line.ingredientId
      }))
    });
  }
  if (!state.dishPacks.some(p => p.id === packId)) {
    state.dishPacks.push({
      id: packId,
      name: normalizedPack.name,
      description: normalizedPack.description || "",
      tags: normalizedPack.tags || [],
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

export function buildPackPrompt(formData = {}) {
  const cuisine = stripDangerousText(formData.cuisine || "mediterránea familiar");
  const meals = stripDangerousText(formData.meals || "cenas y comidas familiares");
  const servings = stripDangerousText(formData.servings || "1 ración por plato");
  const restrictions = stripDangerousText(formData.restrictions || "sin restricciones indicadas");
  const preferences = stripDangerousText(formData.preferences || "recetas sencillas, económicas y saludables");
  const count = Math.max(1, Math.min(Number(formData.count) || 6, 30));

  return `Genera un pack JSON válido para la aplicación Gestor de Menú Semanal.\n\nINSTRUCCIONES DEL USUARIO:\n- Tipo de cocina: ${cuisine}\n- Uso del pack: ${meals}\n- Número de recetas: ${count}\n- Raciones: ${servings}\n- Restricciones/alergias: ${restrictions}\n- Preferencias: ${preferences}\n\nREGLAS OBLIGATORIAS:\n1. Devuelve SOLO JSON válido, sin Markdown ni explicaciones.\n2. El objeto raíz debe tener: schemaVersion, type, id, name, description, tags, language, ingredients, dishes.\n3. Usa schemaVersion: 2 y type: "meal-pack".\n4. Todas las recetas deben estar normalizadas a 1 ración: en cada dish usa servings: 1 y recipe con cantidades para una persona/ración.\n5. Cada dish debe incluir instructions como array ordenado de pasos claros de elaboración.\n6. Cada ingredient usado en una receta debe existir en ingredients y tener id estable.\n7. Unidades permitidas: g, kg, ml, l, unidades.\n8. No incluyas HTML, scripts, comentarios, javascript:, claves privadas ni texto inseguro.\n9. Usa nombres de id simples: ingredient_lentejas, dish_lentejas_verduras, etc.\n10. No inventes códigos de barras. products debe ser [] salvo que el usuario los aporte.\n\nEJEMPLO DE ESTRUCTURA:\n{\n  "schemaVersion": 2,\n  "type": "meal-pack",\n  "id": "pack_ejemplo",\n  "name": "Pack ejemplo",\n  "description": "Descripción breve",\n  "tags": ["familia", "saludable"],\n  "language": "es",\n  "ingredients": [\n    {"id":"ingredient_arroz","name":"Arroz","familyId":"family_pantry","qty":0,"unit":"g","available":false,"storageType":"pantry","expiryDate":"","dateType":"none","approxPrice":0,"packagingType":"otro","products":[]}\n  ],\n  "dishes": [\n    {"id":"dish_arroz_sencillo","name":"Arroz sencillo","servings":1,"unit":"ración","category":"Comida","tags":["básico"],"prepTime":"25 min","difficulty":"fácil","notes":"","instructions":["Lava el arroz.","Cuece con agua hasta que esté tierno."],"recipe":[{"ingredientId":"ingredient_arroz","qty":80,"unit":"g"}]}\n  ]\n}\n\nGenera ahora el pack completo solicitado.`;
}

function slugId(text) {
  return String(text || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}
