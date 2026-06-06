import { DATE_TYPES, STORAGE_TYPES, VALID_UNITS, normalizeUnit } from "./utils.js";

export function validateNoDangerousText(value, label = "texto") {
  if (/javascript:|<\s*script|onerror\s*=|onclick\s*=/gi.test(String(value || ""))) {
    throw new Error(`${label} contiene contenido potencialmente inseguro.`);
  }
}

export function validateState(data) {
  if (!data || typeof data !== "object") throw new Error("El archivo no contiene un objeto válido.");
  const requiredArrays = ["ingredientFamilies", "ingredients", "dishes", "weeks", "familyMembers", "mealTypes", "purchaseLots", "purchaseEntries", "nutritionProfiles", "historySnapshots"];
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) throw new Error(`Falta la colección ${key}.`);
  }
  data.familyMembers.forEach(validateFamilyMember);
  data.mealTypes.forEach(validateMealType);
  data.ingredients.forEach(validateIngredient);
  data.dishes.forEach(d => validateDish(d, data.ingredients));
  data.weeks.forEach(w => validateWeek(w, data.dishes));
  return true;
}

export function validateFamilyMember(member) {
  if (!member.id) throw new Error("Hay un miembro sin id.");
  validateNoDangerousText(member.name, "Nombre de miembro");
  if (!member.name?.trim()) throw new Error("Hay un miembro sin nombre.");
}

export function validateMealType(meal) {
  if (!meal.id) throw new Error("Hay un tipo de comida sin id.");
  validateNoDangerousText(meal.name, "Nombre de comida");
  if (!meal.name?.trim()) throw new Error("Hay un tipo de comida sin nombre.");
}

export function validateIngredient(ingredient) {
  if (!ingredient.id) throw new Error("Hay un ingrediente sin id.");
  validateNoDangerousText(ingredient.name, "Nombre de ingrediente");
  if (!ingredient.name?.trim()) throw new Error("Hay un ingrediente sin nombre.");
  if (Number(ingredient.qty) < 0) throw new Error(`El ingrediente ${ingredient.name} tiene cantidad negativa.`);
  if (!VALID_UNITS.includes(normalizeUnit(ingredient.unit))) throw new Error(`Unidad no válida en ${ingredient.name}.`);
  if (!Array.isArray(ingredient.products)) throw new Error(`products debe ser array en ${ingredient.name}.`);
  ingredient.products.forEach(validateProduct);
}

export function validateProduct(product) {
  validateNoDangerousText(product.productName || "", "Nombre de producto");
  validateNoDangerousText(product.brand || "", "Marca");
  if (product.barcode && !/^\d{6,18}$/.test(String(product.barcode))) throw new Error("Código de barras no válido.");
}

export function validateDish(dish, ingredients = []) {
  validateNoDangerousText(dish.name, "Nombre de plato");
  if (!dish.name?.trim()) throw new Error("Hay un plato sin nombre.");
  if (!Array.isArray(dish.recipe)) throw new Error(`La receta de ${dish.name} no es válida.`);
  const ids = new Set(ingredients.map(i => i.id));
  dish.recipe.forEach(line => {
    if (!ids.has(line.ingredientId)) throw new Error(`El plato ${dish.name} usa un ingrediente inexistente.`);
    if (Number(line.qty) <= 0) throw new Error(`El plato ${dish.name} tiene una cantidad inválida.`);
    if (!VALID_UNITS.includes(normalizeUnit(line.unit))) throw new Error(`Unidad no válida en ${dish.name}.`);
  });
}

export function validateWeek(week, dishes = []) {
  validateNoDangerousText(week.name, "Nombre de semana");
  if (!week.name?.trim()) throw new Error("Hay una semana sin nombre.");
  const dishIds = new Set(dishes.map(d => d.id));
  Object.values(week.plan || {}).flat().forEach(dishId => {
    if (!dishIds.has(dishId)) throw new Error(`La semana ${week.name} contiene un plato inexistente.`);
  });
}

export function validatePurchaseInput(input) {
  const qty = Number(input.purchasedQty);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("La cantidad comprada debe ser mayor que cero.");
  if (!VALID_UNITS.includes(normalizeUnit(input.unit))) throw new Error("Unidad de compra no válida.");
  if (input.dateType && !DATE_TYPES.includes(input.dateType)) throw new Error("Tipo de fecha no válido.");
  if (input.storageType && !STORAGE_TYPES.includes(input.storageType)) throw new Error("Conservación no válida.");
  if (input.barcode && !/^\d{6,18}$/.test(String(input.barcode))) throw new Error("Código de barras no válido.");
  [input.brand, input.notes].forEach(v => validateNoDangerousText(v || "", "Campo de compra"));
}

export function validatePack(pack) {
  if (!pack || typeof pack !== "object") throw new Error("Pack inválido.");
  if (pack.type !== "meal-pack") throw new Error("El pack no es de tipo meal-pack.");
  if (Number(pack.schemaVersion) !== 1) throw new Error("Versión de pack no soportada.");
  validateNoDangerousText(pack.name, "Nombre del pack");
  if (!Array.isArray(pack.ingredients) || !Array.isArray(pack.dishes)) throw new Error("El pack debe contener arrays ingredients y dishes.");
  pack.ingredients.forEach(validateIngredient);
  pack.dishes.forEach(d => validateDish(d, pack.ingredients));
  return true;
}

export function assertSafePackPath(path) {
  if (!path || typeof path !== "string") throw new Error("Ruta de pack vacía.");
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) throw new Error("Ruta de pack insegura.");
  if (!path.endsWith(".json")) throw new Error("Solo se permiten packs .json.");
}
