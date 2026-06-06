import { createDefaultState, SCHEMA_VERSION } from "./models.js";
import { validateState } from "./validation.js";

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

export function migrateData(data) {
  if (!data.meta) data.meta = { schemaVersion: 0, lastMigrationAt: new Date().toISOString() };
  if (data.meta.schemaVersion < 1) {
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
    data.meta.schemaVersion = SCHEMA_VERSION;
    data.meta.lastMigrationAt = new Date().toISOString();
  }
  data.familyMembers ||= [];
  data.mealTypes ||= [];
  data.wasteEntries ||= [];
  data.recyclingEntries ||= [];
  data.settings ||= {};
  data.ingredients ||= [];
  data.ingredients.forEach(ingredient => { ingredient.products ||= []; ingredient.packagingType ||= ingredient.products.find(p => p.packagingType)?.packagingType || "otro"; });
  if (!data.familyMembers.length) data.familyMembers.push({ id: "member_all", name: "Todos", nutritionTargetId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION });
  if (!data.mealTypes.length) data.mealTypes.push({ id: "meal_lunch", name: "Comida", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION });
  return data;
}

export function getState() { return structuredClone(state); }
export function getMutableStateUnsafe() { return state; }

export function setState(nextState, reason = "update") {
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
