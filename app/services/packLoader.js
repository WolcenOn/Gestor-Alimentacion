import { assertSafePackPath, validatePack } from "../validation.js";
import { normalizeUnit, stripDangerousText } from "../utils.js";

export const PACK_SOURCE = Object.freeze({
  owner: "WolcenOn",
  repo: "Gestor-Alimentacion",
  branch: "ux-semana-accesible-fusion",
  basePath: "packs"
});

const GITHUB_API = "https://api.github.com";

export async function listRemotePacks() {
  const root = `${GITHUB_API}/repos/${PACK_SOURCE.owner}/${PACK_SOURCE.repo}/contents/${PACK_SOURCE.basePath}?ref=${PACK_SOURCE.branch}`;
  const files = [];
  await walk(root, files);
  return files.filter(f => String(f.path || "").endsWith(".json") && !String(f.path || "").includes(".."));
}

async function walk(url, files) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "Accept": "application/vnd.github+json" }
  });
  if (!response.ok) {
    const detail = response.status === 403
      ? "GitHub ha limitado temporalmente las peticiones. Vuelve a intentarlo en unos minutos."
      : `Respuesta ${response.status} al listar packs remotos.`;
    throw new Error(`No se pudieron listar los packs remotos. ${detail}`);
  }
  const entries = await response.json();
  for (const entry of entries) {
    if (entry.type === "dir") await walk(entry.url, files);
    if (entry.type === "file" && entry.path.endsWith(".json")) files.push({ name: entry.name, path: entry.path, downloadUrl: entry.download_url });
  }
}

export async function loadRemotePack(file) {
  const relativePath = file.path.replace(`${PACK_SOURCE.basePath}/`, "");
  assertSafePackPath(relativePath);
  const response = await fetch(file.downloadUrl, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo descargar el pack.");
  const text = await response.text();
  if (/javascript:|<\s*script/gi.test(text)) throw new Error("Pack potencialmente inseguro.");
  const pack = normalizePack(JSON.parse(text));
  validatePack(pack);
  return pack;
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
    createdAt: ingredient.createdAt || new Date().toISOString(),
    updatedAt: ingredient.updatedAt || new Date().toISOString(),
    schemaVersion: 1
  };
}

function normalizeMealTypes(dish) {
  const raw = Array.isArray(dish.mealTypes)
    ? dish.mealTypes
    : dish.mealType
      ? [dish.mealType]
      : [];
  return [...new Set(raw.map(value => stripDangerousText(value || "").trim()).filter(Boolean))];
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
    mealTypes: normalizeMealTypes(dish),
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

export function mergePackIntoState(state, pack, options = {}) {
  const normalizedPack = normalizePack(pack);
  validatePack(normalizedPack);
  const selectedDishIds = new Set(options.selectedDishIds || normalizedPack.dishes.map(d => d.id));
  const selectedDishes = normalizedPack.dishes.filter(d => selectedDishIds.has(d.id));
  const requiredIngredientIds = new Set(selectedDishes.flatMap(d => d.recipe.map(line => line.ingredientId)));
  const existingIngredientIds = new Set(state.ingredients.map(i => i.id));
  const existingDishIds = new Set(state.dishes.map(d => d.id));

  for (const ingredient of normalizedPack.ingredients) {
    if (requiredIngredientIds.has(ingredient.id) && !existingIngredientIds.has(ingredient.id)) {
      state.ingredients.push(ingredient);
      existingIngredientIds.add(ingredient.id);
    }
  }

  const packId = normalizedPack.id || slugId(normalizedPack.name);
  for (const dish of selectedDishes) {
    if (!existingDishIds.has(dish.id)) {
      state.dishes.push({ ...dish, packId });
      existingDishIds.add(dish.id);
    }
  }

  const installedIds = state.dishes.filter(dish => dish.packId === packId).map(dish => dish.id);
  const existingPack = state.dishPacks.find(p => p.id === packId);
  if (existingPack) {
    existingPack.installedDishIds = [...new Set(installedIds)];
    existingPack.updatedAt = new Date().toISOString();
  } else {
    state.dishPacks.push({
      id: packId,
      name: normalizedPack.name,
      description: normalizedPack.description || "",
      tags: normalizedPack.tags || [],
      installedDishIds: [...new Set(installedIds)],
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

export function buildPackPrompt(formData = {}) {
  const cuisine = stripDangerousText(formData.cuisine || "mediterránea familiar");
  const meals = stripDangerousText(formData.meals || "desayunos, comidas y cenas");
  const servings = stripDangerousText(formData.servings || "1 ración por plato");
  const restrictions = stripDangerousText(formData.restrictions || "sin restricciones indicadas");
  const preferences = stripDangerousText(formData.preferences || "recetas sencillas, económicas y saludables");
  const count = Math.max(1, Math.min(Number(formData.count) || 6, 30));

  return `Genera un pack JSON válido para la aplicación Gestor de Menú Semanal.\n\nINSTRUCCIONES DEL USUARIO:\n- Tipo de cocina: ${cuisine}\n- Uso del pack: ${meals}\n- Número de recetas: ${count}\n- Raciones: ${servings}\n- Restricciones/alergias: ${restrictions}\n- Preferencias: ${preferences}\n\nREGLAS OBLIGATORIAS:\n1. Devuelve SOLO JSON válido, sin Markdown ni explicaciones.\n2. El objeto raíz debe tener: schemaVersion, type, id, name, description, tags, language, ingredients, dishes.\n3. Usa schemaVersion: 2 y type: "meal-pack".\n4. Todas las recetas deben estar normalizadas a 1 ración: en cada dish usa servings: 1 y recipe con cantidades para una persona/ración.\n5. Cada dish debe incluir mealTypes como array con una o varias comidas compatibles, por ejemplo ["Desayuno"], ["Comida","Cena"] o ["Merienda"]. El pack puede mezclar libremente recetas de distintos tipos.\n6. Cada dish debe incluir instructions como array ordenado de pasos claros de elaboración.\n7. Cada ingredient usado en una receta debe existir en ingredients y tener id estable.\n8. Unidades permitidas: g, kg, ml, l, unidades.\n9. No incluyas HTML, scripts, comentarios, javascript:, claves privadas ni texto inseguro.\n10. Usa nombres de id simples y no inventes códigos de barras.\n\nEJEMPLO DE RECETAS MIXTAS:\n{\n  "schemaVersion": 2,\n  "type": "meal-pack",\n  "id": "pack_ejemplo",\n  "name": "Pack ejemplo",\n  "description": "Desayunos, comidas y cenas",\n  "tags": ["familia", "saludable"],\n  "language": "es",\n  "ingredients": [],\n  "dishes": [\n    {"id":"dish_tostada","name":"Tostada con tomate","servings":1,"mealTypes":["Desayuno"],"category":"Tostadas","tags":[],"instructions":["Preparar y servir."],"recipe":[]},\n    {"id":"dish_arroz","name":"Arroz con verduras","servings":1,"mealTypes":["Comida","Cena"],"category":"Arroces","tags":[],"instructions":["Cocinar y servir."],"recipe":[]}\n  ]\n}\n\nGenera ahora el pack completo solicitado.`;
}

function slugId(text) {
  return String(text || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}
