import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultState } from "../models.js";
import {
  CANONICAL_MATCH_STATUS,
  findIngredientByCanonicalId,
  getIngredientCanonicalId,
  withCanonicalIngredientLink
} from "../state/canonicalIngredients.js";
import { mergePackIntoState, normalizePack } from "../services/packLoader.js";

test("legacy ingredients remain valid without a canonical link", () => {
  const state = createDefaultState();
  const ingredient = state.ingredients[0];

  assert.equal(getIngredientCanonicalId(ingredient), "");
  assert.equal(findIngredientByCanonicalId(state, "arroz_redondo"), null);
});

test("canonical link is additive and preserves local identity, price and products", () => {
  const original = {
    id: "ingredient_arroz_local",
    name: "Arroz redondo",
    qty: 500,
    unit: "g",
    approxPrice: 0.002,
    products: [{ barcode: "123", price: 1.75 }]
  };

  const linked = withCanonicalIngredientLink(original, {
    id: "arroz_redondo",
    name: "Arroz redondo",
    status: "confirmed"
  });

  assert.equal(linked.id, original.id);
  assert.equal(linked.canonicalIngredientId, "arroz_redondo");
  assert.equal(linked.canonicalIngredientName, "Arroz redondo");
  assert.equal(linked.canonicalMatchStatus, CANONICAL_MATCH_STATUS.CONFIRMED);
  assert.equal(linked.approxPrice, original.approxPrice);
  assert.deepEqual(linked.products, original.products);
});

test("recipes continue to reference the local ingredient id", () => {
  const state = createDefaultState();
  const localIngredient = state.ingredients.find(item => item.id === "ingredient_tomate");
  const linked = withCanonicalIngredientLink(localIngredient, {
    id: "tomate_fresco",
    name: "Tomate fresco",
    status: "confirmed"
  });
  Object.assign(localIngredient, linked);

  const recipeLine = state.dishes
    .flatMap(dish => dish.recipe || [])
    .find(line => line.ingredientId === "ingredient_tomate");

  assert.ok(recipeLine);
  assert.equal(recipeLine.ingredientId, "ingredient_tomate");
  assert.equal(findIngredientByCanonicalId(state, "tomate_fresco")?.id, "ingredient_tomate");
});

test("legacy packs still normalize and install without canonical fields", () => {
  const pack = normalizePack({
    schemaVersion: 2,
    type: "meal-pack",
    id: "pack_legacy_test",
    name: "Pack legacy test",
    ingredients: [
      { id: "ingredient_arroz_test", name: "Arroz", qty: 0, unit: "g", products: [] }
    ],
    dishes: [
      {
        id: "dish_arroz_test",
        name: "Arroz test",
        servings: 1,
        recipe: [{ ingredientId: "ingredient_arroz_test", qty: 80, unit: "g" }],
        instructions: ["Cocer el arroz."]
      }
    ]
  });

  const state = createDefaultState();
  mergePackIntoState(state, pack);

  assert.ok(state.ingredients.some(item => item.id === "ingredient_arroz_test"));
  assert.ok(state.dishes.some(item => item.id === "dish_arroz_test"));
  assert.ok(state.dishPacks.some(item => item.id === "pack_legacy_test"));
});
