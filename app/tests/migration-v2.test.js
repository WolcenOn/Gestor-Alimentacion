import assert from "node:assert/strict";

const localStorageMock = (() => {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
  };
})();

globalThis.localStorage ||= localStorageMock;

const { migrateData } = await import("../store.js");

const oldState = {
  meta: { schemaVersion: 1, lastMigrationAt: "2025-01-01T00:00:00.000Z" },
  ingredientFamilies: [{ id: "family_test", name: "Test" }],
  ingredients: [
    {
      id: "ingredient_test",
      name: "Leche",
      familyId: "family_test",
      qty: 0,
      unit: "l",
      trustedPurchase: false,
      trustedPurchaseEnabled: true,
      quickPurchaseTrusted: false,
      products: [
        {
          barcode: "8412345678901",
          brand: "Marca segura",
          productName: "Leche entera",
          packageQty: 1,
          packageUnit: "l"
        }
      ]
    },
    {
      id: "ingredient_without_profile",
      name: "Arroz",
      familyId: "family_test",
      qty: 0,
      unit: "g",
      quickPurchaseTrusted: true,
      products: [
        { barcode: "8422222222222", brand: "Otra marca", productName: "Arroz" }
      ]
    }
  ],
  dishes: [],
  weeks: [],
  familyMembers: [],
  mealTypes: [],
  purchaseLots: [],
  purchaseEntries: [],
  shoppingProgress: {},
  wasteEntries: [],
  recyclingEntries: [],
  nutritionProfiles: [
    {
      id: "profile_test",
      ingredientId: "ingredient_test",
      per: 100,
      unit: "ml",
      kcal: 62,
      protein: 3.2,
      carbs: 4.8,
      fat: 3.5,
      fiber: 0,
      sugar: 4.8,
      salt: 0.12,
      sodium: 0.048,
      source: "legacy"
    }
  ],
  historySnapshots: [],
  dishPacks: [],
  favoriteIds: [],
  settings: {}
};

const first = migrateData(structuredClone(oldState));
const second = migrateData(structuredClone(first));

const migratedIngredient = first.ingredients.find(item => item.id === "ingredient_test");
assert.equal(migratedIngredient.trustedPurchase, true);
assert.equal("trustedPurchaseEnabled" in migratedIngredient, false);
assert.equal("quickPurchaseTrusted" in migratedIngredient, false);
assert.equal(migratedIngredient.products.length, 1);
assert.equal(migratedIngredient.products[0].activeNutrition, true);
assert.deepEqual(migratedIngredient.products[0].nutritionSnapshot, {
  per: 100,
  unit: "ml",
  kcal: 62,
  protein: 3.2,
  carbs: 4.8,
  fat: 3.5,
  fiber: 0,
  sugar: 4.8,
  salt: 0.12,
  sodium: 0.048,
  source: "legacy"
});

const withoutProfile = first.ingredients.find(item => item.id === "ingredient_without_profile");
assert.equal(withoutProfile.trustedPurchase, true);
assert.equal(withoutProfile.products[0].nutritionSnapshot, null);
assert.equal(withoutProfile.products[0].activeNutrition, false);

assert.deepEqual(first.directPurchaseItems, []);
assert.deepEqual(second, first);
assert.equal(first.meta.schemaVersion, 4);

console.log("migration-v2.test.js OK");
