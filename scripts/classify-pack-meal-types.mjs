import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("packs");
const KNOWN = ["Desayuno", "Comida", "Merienda", "Cena"];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalMeal(value) {
  const text = normalize(value);
  if (!text) return "";
  if (/desay|breakfast/.test(text)) return "Desayuno";
  if (/meriend|snack|tentempie/.test(text)) return "Merienda";
  if (/cen|dinner/.test(text)) return "Cena";
  if (/comida|almuerzo|lunch|tupper/.test(text)) return "Comida";
  return "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function classifyDish(dish, filePath, pack) {
  const explicit = Array.isArray(dish.mealTypes)
    ? unique(dish.mealTypes.map(canonicalMeal))
    : dish.mealType
      ? unique([canonicalMeal(dish.mealType)])
      : [];
  if (explicit.length) return explicit;

  const category = normalize(dish.category);
  const name = normalize(dish.name);
  const tags = normalize([...(dish.tags || [])].join(" "));
  const notes = normalize(dish.notes);
  const text = `${category} ${name} ${tags} ${notes}`.trim();
  const meals = [];

  // Strong recipe-level signals. Multiple matches are intentional.
  if (/desay|breakfast/.test(text)) meals.push("Desayuno");
  if (/meriend|snack|tentempie/.test(text)) meals.push("Merienda");
  if (/\bcen\w*\b|dinner/.test(text)) meals.push("Cena");
  if (/\bcomida\w*\b|almuerzo|lunch|tupper/.test(text)) meals.push("Comida");
  if (meals.length) return unique(meals);

  const relative = normalize(path.relative(ROOT, filePath));
  const packText = normalize(`${pack.name || ""} ${(pack.tags || []).join(" ")} ${pack.description || ""}`);

  // Packs whose purpose is unambiguous.
  if (relative.includes("desayunos") || /\bdesayun\w*\b/.test(packText)) return ["Desayuno"];
  if (relative.includes("cenas rapidas") || /\bcenas?\s+rapidas?\b/.test(packText)) return ["Cena"];
  if (relative.includes("tuppers") || /\btupper\w*\b/.test(packText)) return ["Comida"];

  // Desserts are useful as part of lunch/dinner and can also be a snack.
  if (
    relative.includes("postres") ||
    /postre|dessert|mousse|flan|pudin|pudding|natilla|helado|sorbete|bizcocho|tarta|gelatina/.test(text)
  ) return ["Comida", "Merienda", "Cena"];

  // Salads are normally suitable for either main meal unless the recipe says otherwise.
  if (relative.includes("ensaladas") || /ensalada/.test(text)) return ["Comida", "Cena"];

  // Breakfast-shaped recipes outside a breakfast-specific pack.
  if (/\bcafe\b|tostad|porridge|cereales|muesli|granola/.test(text)) return ["Desayuno"];
  if (/avena/.test(text) && /leche|yogur|fruta|platano/.test(text)) return ["Desayuno", "Merienda"];

  // Smoothies, yogurt/fruit bowls and similar small dishes work well for breakfast or snack.
  if (/batido|smoothie|yogur.*fruta|fruta.*yogur/.test(text)) return ["Desayuno", "Merienda"];

  // Traditional/seasonal/vegan/full-menu packs mostly contain main dishes.
  if (
    relative.includes("andalucia") ||
    relative.includes("temporada huelva") ||
    relative.includes("vegano") ||
    relative.includes("verano") ||
    /mediterrane|temporada|vegano|menu/.test(packText)
  ) return ["Comida", "Cena"];

  // Safe fallback for savoury recipes: they can be used at either main meal.
  return ["Comida", "Cena"];
}

function listJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json") out.push(full);
  }
  return out.sort();
}

let filesChanged = 0;
let dishesChanged = 0;
let totalDishes = 0;
const report = [];

for (const file of listJsonFiles(ROOT)) {
  const raw = fs.readFileSync(file, "utf8");
  const pack = JSON.parse(raw);
  if (!Array.isArray(pack.dishes)) continue;

  let changed = false;
  const counts = Object.fromEntries(KNOWN.map(meal => [meal, 0]));
  let multi = 0;

  for (const dish of pack.dishes) {
    totalDishes += 1;
    const next = classifyDish(dish, file, pack);
    for (const meal of next) counts[meal] += 1;
    if (next.length > 1) multi += 1;

    const current = Array.isArray(dish.mealTypes) ? dish.mealTypes : [];
    if (JSON.stringify(current) !== JSON.stringify(next) || "mealType" in dish) {
      dish.mealTypes = next;
      delete dish.mealType;
      dishesChanged += 1;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    filesChanged += 1;
  }

  report.push({
    file: path.relative(process.cwd(), file),
    recipes: pack.dishes.length,
    ...counts,
    multi
  });
}

console.table(report);
console.log(`Clasificación terminada: ${totalDishes} recetas revisadas, ${dishesChanged} recetas actualizadas, ${filesChanged} archivos modificados.`);

if (report.some(row => row.recipes === 0)) {
  console.warn("Hay packs sin recetas; revísalos manualmente.");
}
