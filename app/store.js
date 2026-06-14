import { createDefaultState, SCHEMA_VERSION } from "./models.js";
import { validateState } from "./validation.js";
import { normalizeTrustedPurchaseFlag } from "./fastPurchase.js";
import { getMonthKey, getWeekRange, parseIsoDate } from "./state/calendarPeriods.js";

const STORAGE_KEY = "gestorMenuSemanal.state.v1";
let state = loadState();
const listeners = new Set();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();
  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateData(parsed);
    validateState(migrated);
    return migrated;
  } catch (error) {
    console.error(error);
    const backupKey = `${STORAGE_KEY}.corrupt.${Date.now()}`;
    localStorage.setItem(backupKey, raw);
    return createDefaultState();
  }
}

function ensureBaseCollections(data) {
  data.ingredientFamilies ||= [];
  data.ingredients ||= [];
  data.dishes ||= [];
  data.weeks ||= [];
  data.familyMembers ||= [];
  data.mealTypes ||= [];
  data.purchaseLots ||= [];
  data.purchaseEntries ||= [];
  data.shoppingProgress ||= {};
  data.wasteEntries ||= [];
  data.recyclingEntries ||= [];
  data.nutritionProfiles ||= [];
  data.historySnapshots ||= [];
  data.dishPacks ||= [];
  data.favoriteIds ||= [];
  data.settings ||= {};
}

function migrateTrustedPurchaseFlags(data) {
  data.ingredients ||= [];
  data.ingredients.forEach(ingredient => {
    ingredient.products ||= [];
    ingredient.packagingType ||= ingredient.products.find(p => p.packagingType)?.packagingType || "otro";
    normalizeTrustedPurchaseFlag(ingredient);
  });
}

function snapshotFromNutritionProfile(profile) {
  if (!profile) return null;
  const { id, ingredientId, createdAt, updatedAt, schemaVersion, ...snapshot } = profile;
  return { ...snapshot };
}

function migrateProductNutritionSnapshots(data) {
  const profilesByIngredient = new Map((data.nutritionProfiles || []).map(profile => [profile.ingredientId, profile]));

  data.ingredients.forEach(ingredient => {
    ingredient.products ||= [];
    ingredient.products.forEach(product => {
      if (!("nutritionSnapshot" in product)) product.nutritionSnapshot = null;
      product.activeNutrition = Boolean(product.activeNutrition);
    });

    const barcodeProducts = ingredient.products.filter(product => product.barcode);
    const profile = profilesByIngredient.get(ingredient.id);
    if (profile && barcodeProducts.length === 1) {
      const product = barcodeProducts[0];
      if (!product.nutritionSnapshot) product.nutritionSnapshot = snapshotFromNutritionProfile(profile);
      ingredient.products.forEach(item => { item.activeNutrition = item === product; });
    }
  });
}

function migrateWeekDates(data) {
  const currentRange = getWeekRange();
  data.weeks ||= [];
  data.weeks.forEach((week, index) => {
    const baseDate = parseIsoDate(week.startDate) || getWeekRange(new Date(Date.now() + index * 7 * 24 * 60 * 60 * 1000)).start;
    const range = index === 0 && !week.startDate ? currentRange : getWeekRange(baseDate);
    week.startDate ||= range.startDate;
    week.endDate ||= range.endDate;
    if (!week.id || week.id === "week_current") week.id = range.id;
    if (!week.name || week.name === "Semana actual") week.name = range.name;
    week.plan ||= {};
  });

  if (data.activeWeekId === "week_current" && data.weeks[0]) data.activeWeekId = data.weeks[0].id;
  if (!data.activeWeekId && data.weeks[0]) data.activeWeekId = data.weeks[0].id;
  data.settings ||= {};
  data.settings.calendarView ||= "week";
  const activeWeek = data.weeks.find(week => week.id === data.activeWeekId) || data.weeks[0];
  data.settings.calendarMonth ||= activeWeek?.startDate?.slice(0, 7) || getMonthKey();
}

export function migrateData(data) {
  if (!data.meta) data.meta = { schemaVersion: 0, lastMigrationAt: new Date().toISOString() };
  ensureBaseCollections(data);

  if (data.meta.schemaVersion < 1) {
    data.meta.schemaVersion = 1;
    data.meta.lastMigrationAt = new Date().toISOString();
  }

  if (data.meta.schemaVersion < 2) {
    migrateTrustedPurchaseFlags(data);
    migrateProductNutritionSnapshots(data);
    data.meta.schemaVersion = 2;
    data.meta.lastMigrationAt = new Date().toISOString();
  }

  if (data.meta.schemaVersion < 3) {
    migrateWeekDates(data);
    data.meta.schemaVersion = 3;
    data.meta.lastMigrationAt = new Date().toISOString();
  }

  migrateTrustedPurchaseFlags(data);
  migrateProductNutritionSnapshots(data);
  migrateWeekDates(data);
  data.meta.schemaVersion = SCHEMA_VERSION;

  if (!data.familyMembers.length) data.familyMembers.push({ id: "member_all", name: "Todos", nutritionTargetId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION });
  if (!data.mealTypes.length) data.mealTypes.push({ id: "meal_lunch", name: "Comida", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION });
  return data;
}

export function getState() { return structuredClone(state); }
export function getMutableStateUnsafe() { return state; }

export function setState(nextState, reason = "update") {
  migrateData(nextState);
  validateState(nextState);
  state = nextState;
  saveState();
  notify(reason);
}

export function updateState(mutator, reason = "update") {
  const draft = structuredClone(state);
  mutator(draft);
  setState(draft, reason);
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(reason) {
  for (const listener of listeners) listener(getState(), reason);
}

export function resetDemoData() {
  setState(createDefaultState(), "reset");
}
