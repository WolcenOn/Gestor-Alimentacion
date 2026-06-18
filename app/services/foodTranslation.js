const FOOD_TRANSLATIONS_ES_EN = new Map(Object.entries({
  "aceite": "oil",
  "aceite de girasol": "sunflower oil",
  "aceite de oliva": "olive oil",
  "aceite de oliva virgen extra": "extra virgin olive oil",
  "aceituna": "olive",
  "acelga": "chard",
  "aguacate": "avocado",
  "ajo": "garlic",
  "albahaca": "basil",
  "alcachofa": "artichoke",
  "almendra": "almond",
  "almeja": "clam",
  "alubia": "bean",
  "alubia blanca": "white bean",
  "apio": "celery",
  "arandano": "blueberry",
  "arándano": "blueberry",
  "arroz": "rice",
  "arroz basmati": "basmati rice",
  "arroz blanco": "white rice",
  "arroz integral": "brown rice",
  "atun": "tuna",
  "atún": "tuna",
  "avellana": "hazelnut",
  "avena": "oats",
  "azucar": "sugar",
  "azúcar": "sugar",
  "bacalao": "cod",
  "bacon": "bacon",
  "berenjena": "eggplant",
  "boniato": "sweet potato",
  "brócoli": "broccoli",
  "brocoli": "broccoli",
  "caballa": "mackerel",
  "calabacin": "zucchini",
  "calabacín": "zucchini",
  "calabaza": "pumpkin",
  "calamar": "squid",
  "canela": "cinnamon",
  "carne picada": "ground beef",
  "cebolla": "onion",
  "cebolla morada": "red onion",
  "cebolleta": "spring onion",
  "cerdo": "pork",
  "cereza": "cherry",
  "champinon": "mushroom",
  "champiñon": "mushroom",
  "champiñón": "mushroom",
  "chocolate": "chocolate",
  "chorizo": "chorizo",
  "ciruela": "plum",
  "col": "cabbage",
  "coliflor": "cauliflower",
  "conejo": "rabbit",
  "copos de avena": "rolled oats",
  "cordero": "lamb",
  "datil": "date",
  "dátil": "date",
  "espagueti": "spaghetti",
  "espárrago": "asparagus",
  "esparrago": "asparagus",
  "espinaca": "spinach",
  "fideo": "noodle",
  "fresa": "strawberry",
  "garbanzo": "chickpea",
  "gamba": "shrimp",
  "guisante": "pea",
  "harina": "flour",
  "harina de trigo": "wheat flour",
  "higo": "fig",
  "huevo": "egg",
  "jamon": "ham",
  "jamón": "ham",
  "jamon cocido": "cooked ham",
  "jamón cocido": "cooked ham",
  "judia verde": "green bean",
  "judía verde": "green bean",
  "kiwi": "kiwi fruit",
  "langostino": "prawn",
  "leche": "milk",
  "leche desnatada": "skim milk",
  "leche entera": "whole milk",
  "lechuga": "lettuce",
  "lenteja": "lentil",
  "lima": "lime",
  "limon": "lemon",
  "limón": "lemon",
  "macarron": "macaroni",
  "macarrón": "macaroni",
  "maiz": "corn",
  "maíz": "corn",
  "mandarina": "tangerine",
  "mango": "mango",
  "mantequilla": "butter",
  "manzana": "apple",
  "mayonesa": "mayonnaise",
  "mejillon": "mussel",
  "mejillón": "mussel",
  "melon": "melon",
  "melón": "melon",
  "merluza": "hake",
  "miel": "honey",
  "morcilla": "blood sausage",
  "naranja": "orange",
  "nata": "cream",
  "nuez": "walnut",
  "pan": "bread",
  "pan blanco": "white bread",
  "pan integral": "whole wheat bread",
  "pasta": "pasta",
  "patata": "potato",
  "pavo": "turkey",
  "pepino": "cucumber",
  "pera": "pear",
  "perejil": "parsley",
  "pescado blanco": "white fish",
  "pez espada": "swordfish",
  "pimiento": "pepper",
  "pimiento rojo": "red pepper",
  "pimiento verde": "green pepper",
  "pina": "pineapple",
  "piña": "pineapple",
  "pinon": "pine nut",
  "piñon": "pine nut",
  "platano": "banana",
  "plátano": "banana",
  "pollo": "chicken",
  "pollo entero": "whole chicken",
  "puerro": "leek",
  "queso": "cheese",
  "queso fresco": "fresh cheese",
  "queso manchego": "manchego cheese",
  "quinoa": "quinoa",
  "rape": "monkfish",
  "remolacha": "beetroot",
  "repollo": "cabbage",
  "salchicha": "sausage",
  "salmon": "salmon",
  "salmón": "salmon",
  "sandia": "watermelon",
  "sandía": "watermelon",
  "sardina": "sardine",
  "sepia": "cuttlefish",
  "soja": "soybean",
  "solomillo": "sirloin",
  "ternera": "beef",
  "tofu": "tofu",
  "tomate": "tomato",
  "tomate cherry": "cherry tomato",
  "tomate triturado": "crushed tomato",
  "tortilla": "omelette",
  "trigo": "wheat",
  "uva": "grape",
  "yogur": "yogurt",
  "yogur griego": "greek yogurt",
  "zanahoria": "carrot"
}));

const PHRASE_REPLACEMENTS = [
  [/\bpechuga de pollo\b/g, "chicken breast"],
  [/\bmuslo de pollo\b/g, "chicken thigh"],
  [/\bcarne de ternera\b/g, "beef"],
  [/\bcarne de cerdo\b/g, "pork"],
  [/\blomo de cerdo\b/g, "pork loin"],
  [/\bfilete de ternera\b/g, "beef steak"],
  [/\batun en conserva\b/g, "canned tuna"],
  [/\batún en conserva\b/g, "canned tuna"],
  [/\bbonito del norte\b/g, "tuna"],
  [/\bqueso de cabra\b/g, "goat cheese"],
  [/\bqueso azul\b/g, "blue cheese"],
  [/\bleche semidesnatada\b/g, "semi skimmed milk"],
  [/\byogur natural\b/g, "plain yogurt"],
  [/\byogur natural sin azucar\b/g, "plain unsweetened yogurt"],
  [/\byogur natural sin azúcar\b/g, "plain unsweetened yogurt"],
  [/\barroz cocido\b/g, "cooked rice"],
  [/\bpasta cocida\b/g, "cooked pasta"],
  [/\bpatata cocida\b/g, "boiled potato"],
  [/\bhuevo cocido\b/g, "boiled egg"],
  [/\btomate frito\b/g, "tomato sauce"],
  [/\bpan de molde\b/g, "sandwich bread"]
];

const PREPARATION_WORDS = new Map(Object.entries({
  "crudo": "raw",
  "cruda": "raw",
  "cocido": "cooked",
  "cocida": "cooked",
  "hervido": "boiled",
  "hervida": "boiled",
  "asado": "roasted",
  "asada": "roasted",
  "frito": "fried",
  "frita": "fried",
  "congelado": "frozen",
  "congelada": "frozen",
  "en lata": "canned",
  "conserva": "canned",
  "natural": "plain",
  "integral": "whole wheat"
}));

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyPhraseReplacements(value) {
  let output = ` ${normalizeText(value)} `;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }
  return output.replace(/\s+/g, " ").trim();
}

function translateToken(token) {
  return FOOD_TRANSLATIONS_ES_EN.get(token) || PREPARATION_WORDS.get(token) || token;
}

export function translateFoodQueryToEnglish(query) {
  const normalized = normalizeText(query);
  if (!normalized) return { query: "", translated: false, original: query || "" };

  if (FOOD_TRANSLATIONS_ES_EN.has(normalized)) {
    return { query: FOOD_TRANSLATIONS_ES_EN.get(normalized), translated: true, original: query };
  }

  const phraseTranslated = applyPhraseReplacements(normalized);
  if (phraseTranslated !== normalized) {
    return { query: phraseTranslated, translated: true, original: query };
  }

  const translatedTokens = normalized.split(" ").map(translateToken);
  const translated = translatedTokens.join(" ").replace(/\s+/g, " ").trim();
  return {
    query: translated,
    translated: translated !== normalized,
    original: query
  };
}

export function getKnownFoodTranslations() {
  return Array.from(FOOD_TRANSLATIONS_ES_EN.entries()).map(([es, en]) => ({ es, en }));
}
