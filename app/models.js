import { uid, nowIso, todayIsoDate } from "./utils.js";

export const SCHEMA_VERSION = 2;

export function withMeta(entity, prefix) {
  const stamp = nowIso();
  return { id: entity.id || uid(prefix), createdAt: entity.createdAt || stamp, updatedAt: stamp, schemaVersion: SCHEMA_VERSION, ...entity };
}

export function createDefaultState() {
  const families = [
    { id: "family_veg", name: "Verdura", color: "#4d8f57" },
    { id: "family_fruit", name: "Fruta", color: "#d48b35" },
    { id: "family_protein", name: "Proteína", color: "#8b4d8f" },
    { id: "family_dairy", name: "Lácteos", color: "#3d83b5" },
    { id: "family_pantry", name: "Despensa", color: "#94703a" },
    { id: "family_other", name: "Otros", color: "#777777" }
  ].map(f => withMeta(f, "family"));

  const ingredients = [
    { id: "ingredient_huevo", name: "Huevos", familyId: "family_protein", qty: 4, unit: "unidades", available: true, storageType: "fridge", expiryDate: "", dateType: "expiry", approxPrice: 0.25, packagingType: "cartón/papel", products: [] },
    { id: "ingredient_tomate", name: "Tomate", familyId: "family_veg", qty: 250, unit: "g", available: true, storageType: "fridge", expiryDate: "", dateType: "expiry", approxPrice: 0.003, packagingType: "orgánico", products: [] },
    { id: "ingredient_atun", name: "Atún en lata", familyId: "family_protein", qty: 0, unit: "g", available: false, storageType: "pantry", expiryDate: "", dateType: "bestBefore", approxPrice: 0.015, packagingType: "metal", products: [] }
  ].map(i => withMeta(i, "ingredient"));

  const dishes = [
    { id: "dish_ensalada", name: "Ensalada de tomate con atún", servings: 2, unit: "raciones", category: "Cena ligera", tags: ["rápido"], prepTime: "10 min", difficulty: "fácil", approxPrice: 3.2, notes: "", recipe: [
      { ingredientId: "ingredient_tomate", qty: 500, unit: "g" },
      { ingredientId: "ingredient_atun", qty: 160, unit: "g" },
      { ingredientId: "ingredient_huevo", qty: 2, unit: "unidades" }
    ], packId: "pack_demo" },
    { id: "dish_tortilla", name: "Tortilla francesa", servings: 1, unit: "raciones", category: "Cena", tags: ["fácil"], prepTime: "8 min", difficulty: "fácil", approxPrice: 1.0, notes: "", recipe: [
      { ingredientId: "ingredient_huevo", qty: 2, unit: "unidades" }
    ], packId: "pack_demo" }
  ].map(d => withMeta(d, "dish"));

  const mealTypes = [
    { id: "meal_breakfast", name: "Desayuno" },
    { id: "meal_lunch", name: "Comida" },
    { id: "meal_snack", name: "Merienda" },
    { id: "meal_dinner", name: "Cena" }
  ].map(m => withMeta(m, "meal"));

  const familyMembers = [
    { id: "member_all", name: "Todos", nutritionTargetId: null },
    { id: "member_virginia", name: "Virginia", nutritionTargetId: null },
    { id: "member_ninos", name: "Niños", nutritionTargetId: null }
  ].map(m => withMeta(m, "member"));

  const weeks = [withMeta({
    id: "week_current",
    name: "Semana actual",
    isTypical: true,
    plan: {
      "lunes__meal_dinner__member_all": ["dish_ensalada"],
      "martes__meal_dinner__member_all": ["dish_tortilla"],
      "miércoles__meal_lunch__member_all": ["dish_ensalada"],
      "lunes__meal_dinner__member_virginia": ["dish_tortilla"],
      "martes__meal_lunch__member_ninos": ["dish_ensalada", "dish_tortilla"]
    }
  }, "week")];

  return {
    meta: { schemaVersion: SCHEMA_VERSION, lastMigrationAt: nowIso() },
    ingredientFamilies: families,
    ingredients,
    dishes,
    dishPacks: [{ id: "pack_demo", name: "Pack demo", description: "Datos de ejemplo", tags: ["demo"], createdAt: nowIso(), updatedAt: nowIso(), schemaVersion: SCHEMA_VERSION }],
    weeks,
    activeWeekId: "week_current",
    familyMembers,
    mealTypes,
    favoriteIds: [],
    purchaseLots: [],
    purchaseEntries: [],
    wasteEntries: [],
    recyclingEntries: [],
    shoppingProgress: {},
    nutritionProfiles: [],
    historySnapshots: [],
    settings: { createdOn: todayIsoDate() }
  };
}
