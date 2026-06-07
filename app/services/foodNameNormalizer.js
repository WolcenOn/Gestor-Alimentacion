const FOOD_TRANSLATIONS = new Map([
  ["aceite de oliva", "olive oil"],
  ["acelga", "swiss chard"],
  ["acelgas", "swiss chard"],
  ["aguacate", "avocado"],
  ["ajo", "garlic"],
  ["albahaca", "basil"],
  ["albondigas", "meatballs"],
  ["alcachofa", "artichoke"],
  ["alcachofas", "artichoke"],
  ["alubia", "white beans"],
  ["alubias", "white beans"],
  ["arandano", "blueberries"],
  ["arandanos", "blueberries"],
  ["arroz", "rice"],
  ["arroz basmati", "basmati rice"],
  ["arroz integral", "brown rice"],
  ["atun", "tuna"],
  ["avena", "oats"],
  ["bacalao", "cod"],
  ["berenjena", "eggplant"],
  ["boniato", "sweet potato"],
  ["brocoli", "broccoli"],
  ["brotes tiernos", "mixed baby greens"],
  ["caballa", "mackerel"],
  ["calabacin", "zucchini"],
  ["calabaza", "pumpkin"],
  ["cebolla", "onion"],
  ["cerdo", "pork"],
  ["champiñones", "mushrooms"],
  ["champinones", "mushrooms"],
  ["coliflor", "cauliflower"],
  ["cuscus", "couscous"],
  ["espinaca", "spinach"],
  ["espinacas", "spinach"],
  ["fresa", "strawberries"],
  ["fresas", "strawberries"],
  ["garbanzo", "chickpeas"],
  ["garbanzos", "chickpeas"],
  ["guisante", "green peas"],
  ["guisantes", "green peas"],
  ["haba", "fava beans"],
  ["habas", "fava beans"],
  ["huevo", "egg"],
  ["jamon", "ham"],
  ["lenteja", "lentils"],
  ["lentejas", "lentils"],
  ["limon", "lemon"],
  ["mandarina", "tangerine"],
  ["manzana", "apple"],
  ["merluza", "hake"],
  ["naranja", "orange"],
  ["pan", "bread"],
  ["pasta", "pasta"],
  ["pasta integral", "whole wheat pasta"],
  ["patata", "potato"],
  ["pavo", "turkey"],
  ["pepino", "cucumber"],
  ["pera", "pear"],
  ["pescado", "fish"],
  ["pimiento", "bell pepper"],
  ["pimiento rojo", "red bell pepper"],
  ["pimiento verde", "green bell pepper"],
  ["platano", "banana"],
  ["pollo", "chicken breast"],
  ["queso", "cheese"],
  ["queso fresco", "fresh cheese"],
  ["quinoa", "quinoa"],
  ["salmon", "salmon"],
  ["sandia", "watermelon"],
  ["setas", "mushrooms"],
  ["ternera", "beef"],
  ["tofu", "tofu"],
  ["tomate", "tomato"],
  ["tomate frito", "tomato sauce"],
  ["tomate triturado", "crushed tomatoes"],
  ["zanahoria", "carrot"],
  ["yogur", "plain yogurt"]
]);

const REMOVE_WORDS = [
  "fresco", "fresca", "frescas", "frescos", "cocido", "cocida", "cocidos", "cocidas",
  "conserva", "bote", "lata", "natural", "sin azucar", "sin azúcar", "virgen extra",
  "entero", "entera", "troceado", "troceada", "desalado", "desalada", "tierno", "tierna"
];

export function normalizeFoodName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildUsdaQueries(name = "") {
  const normalized = normalizeFoodName(name);
  const withoutNoise = REMOVE_WORDS.reduce((text, word) => text.replace(new RegExp(`\\b${normalizeFoodName(word)}\\b`, "g"), " "), normalized).replace(/\s+/g, " ").trim();
  const queries = [];

  for (const [spanish, english] of FOOD_TRANSLATIONS.entries()) {
    if (normalized.includes(spanish) || withoutNoise.includes(spanish)) queries.push(english);
  }

  if (withoutNoise && !queries.includes(withoutNoise)) queries.push(withoutNoise);
  if (normalized && normalized !== withoutNoise && !queries.includes(normalized)) queries.push(normalized);

  return [...new Set(queries)].slice(0, 4);
}

export function scoreFoodMatch(food, ingredientName = "") {
  const description = normalizeFoodName(food?.description || food?.lowercaseDescription || "");
  const ingredient = normalizeFoodName(ingredientName);
  const queries = buildUsdaQueries(ingredientName).map(normalizeFoodName);
  let score = 0;

  if (!description) return score;
  for (const query of queries) {
    if (description === query) score += 80;
    else if (description.includes(query)) score += 45;
    else if (query.includes(description)) score += 20;
  }

  if (/raw|fresh|uncooked/.test(description)) score += 12;
  if (/branded/.test(String(food?.dataType || "").toLowerCase())) score -= 8;
  if (/prepared|recipe|restaurant|fast food|babyfood/.test(description)) score -= 18;
  if (ingredient.includes("cocid") && /cooked/.test(description)) score += 18;
  if (ingredient.includes("integral") && /whole/.test(description)) score += 18;

  return score;
}

export function isBulkCandidateIngredient(ingredient, nutritionProfiles = []) {
  if (!ingredient || !ingredient.id) return false;
  if (nutritionProfiles.some(profile => profile.ingredientId === ingredient.id)) return false;
  const hasProductsWithNutrition = (ingredient.products || []).some(product => product.nutriments || product.nutriscore || product.source === "openfoodfacts");
  if (hasProductsWithNutrition) return true;
  return true;
}
