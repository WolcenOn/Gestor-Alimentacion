const FOOD_TRANSLATIONS = new Map([
  ["aceite de oliva", ["olive oil", "oil olive"]],
  ["acelga", ["swiss chard", "chard raw"]],
  ["acelgas", ["swiss chard", "chard raw"]],
  ["aguacate", ["avocado", "avocados raw"]],
  ["ajo", ["garlic", "garlic raw"]],
  ["albahaca", ["basil", "basil fresh"]],
  ["albondigas", ["meatballs"]],
  ["alcachofa", ["artichoke", "artichokes raw", "artichokes cooked"]],
  ["alcachofas", ["artichoke", "artichokes raw", "artichokes cooked"]],
  ["alubia", ["white beans", "beans white mature seeds cooked", "navy beans cooked"]],
  ["alubias", ["white beans", "beans white mature seeds cooked", "navy beans cooked"]],
  ["arandano", ["blueberries", "blueberries raw"]],
  ["arandanos", ["blueberries", "blueberries raw"]],
  ["arroz", ["rice", "rice white cooked", "rice white raw"]],
  ["arroz basmati", ["basmati rice", "rice basmati cooked"]],
  ["arroz integral", ["brown rice", "rice brown cooked", "rice brown long grain cooked"]],
  ["atun", ["tuna", "fish tuna fresh", "tuna canned in water"]],
  ["avena", ["oats", "oats raw", "rolled oats"]],
  ["bacalao", ["cod", "fish cod atlantic raw", "cod cooked"]],
  ["berenjena", ["eggplant", "eggplant raw", "eggplant cooked"]],
  ["boniato", ["sweet potato", "sweet potato raw", "sweet potato cooked baked"]],
  ["brocoli", ["broccoli", "broccoli raw", "broccoli cooked"]],
  ["brotes tiernos", ["mixed baby greens", "lettuce spring mix", "baby greens"]],
  ["caballa", ["mackerel", "fish mackerel raw"]],
  ["calabacin", ["zucchini", "courgette", "squash summer zucchini", "squash summer all varieties raw", "zucchini includes skin raw", "zucchini cooked"]],
  ["calabacines", ["zucchini", "courgette", "squash summer zucchini", "squash summer all varieties raw", "zucchini includes skin raw", "zucchini cooked"]],
  ["calabaza", ["pumpkin", "pumpkin raw", "winter squash", "squash winter raw"]],
  ["cebolla", ["onion", "onions raw", "onions cooked"]],
  ["cerdo", ["pork", "pork loin"]],
  ["champiñones", ["mushrooms", "mushrooms white raw", "mushrooms cooked"]],
  ["champinones", ["mushrooms", "mushrooms white raw", "mushrooms cooked"]],
  ["coliflor", ["cauliflower", "cauliflower raw", "cauliflower cooked"]],
  ["cuscus", ["couscous", "couscous cooked"]],
  ["espinaca", ["spinach", "spinach raw", "spinach cooked"]],
  ["espinacas", ["spinach", "spinach raw", "spinach cooked"]],
  ["fresa", ["strawberries", "strawberries raw"]],
  ["fresas", ["strawberries", "strawberries raw"]],
  ["garbanzo", ["chickpeas", "chickpeas cooked", "garbanzo beans cooked", "chickpeas canned"]],
  ["garbanzos", ["chickpeas", "chickpeas cooked", "garbanzo beans cooked", "chickpeas canned"]],
  ["guisante", ["green peas", "peas green raw", "peas green cooked"]],
  ["guisantes", ["green peas", "peas green raw", "peas green cooked"]],
  ["haba", ["fava beans", "broadbeans", "fava beans cooked"]],
  ["habas", ["fava beans", "broadbeans", "fava beans cooked"]],
  ["huevo", ["egg", "egg whole raw", "egg whole cooked"]],
  ["jamon", ["ham"]],
  ["judias verdes", ["green beans", "snap beans raw", "snap beans cooked"]],
  ["judia verde", ["green beans", "snap beans raw", "snap beans cooked"]],
  ["lechuga", ["lettuce", "lettuce raw", "romaine lettuce"]],
  ["lenteja", ["lentils", "lentils cooked", "lentils raw"]],
  ["lentejas", ["lentils", "lentils cooked", "lentils raw"]],
  ["limon", ["lemon", "lemons raw"]],
  ["maiz", ["corn", "sweet corn", "corn sweet yellow raw", "corn sweet yellow cooked"]],
  ["mandarina", ["tangerine", "mandarin oranges raw"]],
  ["manzana", ["apple", "apples raw with skin"]],
  ["merluza", ["hake", "fish hake raw"]],
  ["naranja", ["orange", "oranges raw"]],
  ["pan", ["bread"]],
  ["pasta", ["pasta", "pasta cooked", "spaghetti cooked"]],
  ["pasta integral", ["whole wheat pasta", "spaghetti whole wheat cooked"]],
  ["patata", ["potato", "potatoes raw", "potatoes boiled cooked"]],
  ["pavo", ["turkey", "turkey breast"]],
  ["pepino", ["cucumber", "cucumber with peel raw"]],
  ["pera", ["pear", "pears raw"]],
  ["pescado", ["fish"]],
  ["pimiento", ["bell pepper", "peppers sweet raw"]],
  ["pimiento rojo", ["red bell pepper", "peppers sweet red raw"]],
  ["pimiento verde", ["green bell pepper", "peppers sweet green raw"]],
  ["platano", ["banana", "bananas raw"]],
  ["pollo", ["chicken breast", "chicken breast meat raw", "chicken breast cooked"]],
  ["puerro", ["leek", "leeks raw", "leeks cooked"]],
  ["queso", ["cheese"]],
  ["queso fresco", ["fresh cheese", "queso fresco"]],
  ["quinoa", ["quinoa", "quinoa cooked", "quinoa uncooked"]],
  ["salmon", ["salmon", "fish salmon atlantic raw", "salmon cooked"]],
  ["sandia", ["watermelon", "watermelon raw"]],
  ["setas", ["mushrooms", "mushrooms raw", "mushrooms cooked"]],
  ["ternera", ["beef", "beef lean"]],
  ["tofu", ["tofu", "tofu raw", "tofu firm"]],
  ["tomate", ["tomato", "tomatoes red ripe raw"]],
  ["tomate frito", ["tomato sauce", "tomato puree", "tomato products canned sauce"]],
  ["tomate triturado", ["crushed tomatoes", "tomatoes canned crushed", "tomato puree"]],
  ["zanahoria", ["carrot", "carrots raw", "carrots cooked"]],
  ["yogur", ["plain yogurt", "yogurt plain whole milk", "yogurt plain low fat"]]
]);

const DIRECT_USDA_ALIASES = new Map([
  ["calabacin", ["Squash, summer, zucchini, includes skin, raw", "Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt"]],
  ["calabacines", ["Squash, summer, zucchini, includes skin, raw", "Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt"]],
  ["garbanzos", ["Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt", "Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained solids"]],
  ["lentejas", ["Lentils, mature seeds, cooked, boiled, without salt"]],
  ["acelgas", ["Chard, swiss, raw", "Chard, swiss, cooked, boiled, drained, without salt"]],
  ["berenjena", ["Eggplant, raw", "Eggplant, cooked, boiled, drained, without salt"]],
  ["pimiento rojo", ["Peppers, sweet, red, raw"]],
  ["pimiento verde", ["Peppers, sweet, green, raw"]]
]);

const REMOVE_WORDS = [
  "fresco", "fresca", "frescas", "frescos", "cocido", "cocida", "cocidos", "cocidas",
  "conserva", "bote", "lata", "natural", "sin azucar", "sin azúcar", "virgen extra",
  "entero", "entera", "troceado", "troceada", "desalado", "desalada", "tierno", "tierna",
  "de temporada", "ecologico", "ecologica", "eco", "bio", "granel", "a granel", "pieza", "unidad"
];

const BULK_HINT_WORDS = ["raw", "fresh", "uncooked", "cooked", "boiled", "drained", "without salt"];

export function normalizeFoodName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))];
}

function getTranslationsFor(normalized, withoutNoise) {
  const matches = [];
  for (const [spanish, englishValues] of FOOD_TRANSLATIONS.entries()) {
    if (normalized.includes(spanish) || withoutNoise.includes(spanish)) matches.push(...englishValues);
  }
  return matches;
}

export function buildUsdaQueries(name = "") {
  const normalized = normalizeFoodName(name);
  const withoutNoise = REMOVE_WORDS.reduce((text, word) => text.replace(new RegExp(`\\b${normalizeFoodName(word)}\\b`, "g"), " "), normalized).replace(/\s+/g, " ").trim();
  const directAliases = [];
  for (const [spanish, aliases] of DIRECT_USDA_ALIASES.entries()) {
    if (normalized.includes(spanish) || withoutNoise.includes(spanish)) directAliases.push(...aliases);
  }
  const translated = getTranslationsFor(normalized, withoutNoise);
  const broad = translated.flatMap(q => {
    const base = normalizeFoodName(q);
    const additions = [];
    if (!/raw|cooked|boiled|canned/.test(base)) {
      additions.push(`${q} raw`, `${q} cooked`);
    }
    return [q, ...additions];
  });

  return unique([
    ...directAliases,
    ...broad,
    withoutNoise,
    normalized
  ]).slice(0, 12);
}

export function scoreFoodMatch(food, ingredientName = "") {
  const description = normalizeFoodName(food?.description || food?.lowercaseDescription || "");
  const ingredient = normalizeFoodName(ingredientName);
  const queries = buildUsdaQueries(ingredientName).map(normalizeFoodName);
  let score = 0;

  if (!description) return score;
  for (const query of queries) {
    const q = normalizeFoodName(query);
    if (!q) continue;
    if (description === q) score += 110;
    else if (description.includes(q)) score += 70;
    else {
      const words = q.split(" ").filter(w => w.length > 2 && !["raw", "cooked", "with", "skin", "salt", "and", "all"].includes(w));
      const matchedWords = words.filter(word => description.includes(word)).length;
      if (words.length && matchedWords / words.length >= 0.65) score += 42;
    }
  }

  if (/raw|fresh|uncooked/.test(description)) score += ingredient.includes("cocid") ? 0 : 18;
  if (/cooked|boiled|drained/.test(description) && ingredient.includes("cocid")) score += 24;
  if (/canned/.test(description) && /(bote|lata|conserva)/.test(ingredient)) score += 28;
  if (/branded/.test(String(food?.dataType || "").toLowerCase())) score -= 12;
  if (/prepared|recipe|restaurant|fast food|babyfood|infant/.test(description)) score -= 24;
  if (ingredient.includes("integral") && /whole/.test(description)) score += 22;
  if (BULK_HINT_WORDS.some(word => description.includes(word))) score += 4;

  return score;
}

export function describeUsdaQueryPlan(name = "") {
  return buildUsdaQueries(name).join(" · ");
}

export function isBulkCandidateIngredient(ingredient, nutritionProfiles = []) {
  if (!ingredient || !ingredient.id) return false;
  if (nutritionProfiles.some(profile => profile.ingredientId === ingredient.id)) return false;
  return true;
}
