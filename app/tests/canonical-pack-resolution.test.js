import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultState } from "../models.js";
import { mergePackIntoState, normalizePack } from "../services/packLoader.js";
import { withCanonicalIngredientLink } from "../state/canonicalIngredients.js";

function canonicalPack({ ingredients, recipe }) {
  return {
    schemaVersion: 2,
    type: "meal-pack",
    id: "pack_canonical_test",
    name: "Pack canonical test",
    ingredients,
    dishes: [
      {
        id: "dish_canonical_test",
        name: "Plato canonical test",
        servings: 1,
        recipe,
        instructions: ["Preparar y servir."]
      }
    ]
  };
}

test("pack normalization preserves optional canonical ingredient metadata", () => {
  const pack = normalizePack(canonicalPack({
    ingredients: [
      {
        id: "ingredient_pack_rice",
        name: "Arroz redondo",
        unit: "g",
        canonicalIngredientId: " arroz_redondo ",
        canonicalIngredientName: "Arroz redondo",
        canonicalMatchStatus: "confirmed"
      }
    ],
    recipe: [{ ingredientId: "ingredient_pack_rice", qty: 80, unit: "g" }]
  }));

  const ingredient = pack.ingredients[0];
  assert.equal(ingredient.canonicalIngredientId, "arroz_redondo");
  assert.equal(ingredient.canonicalIngredientName, "Arroz redondo");
  assert.equal(ingredient.canonicalMatchStatus, "confirmed");
});

test("installing a canonical pack reuses an existing linked local ingredient", () => {
  const state = createDefaultState();
  const local = state.ingredients[0];
  Object.assign(local, withCanonicalIngredientLink(local, {
    id: "arroz_redondo",
    name: "Arroz redondo",
    status: "confirmed"
  }));
  const ingredientCountBefore = state.ingredients.length;

  mergePackIntoState(state, canonicalPack({
    ingredients: [
      {
        id: "ingredient_pack_rice",
        name: "Arroz redondo del pack",
        unit: "g",
        canonicalIngredientId: "arroz_redondo",
        canonicalIngredientName: "Arroz redondo",
        canonicalMatchStatus: "confirmed"
      }
    ],
    recipe: [{ ingredientId: "ingredient_pack_rice", qty: 80, unit: "g" }]
  }));

  assert.equal(state.ingredients.length, ingredientCountBefore);
  const dish = state.dishes.find(item => item.id === "dish_canonical_test");
  assert.ok(dish);
  assert.equal(dish.recipe[0].ingredientId, local.id);
  assert.equal(state.ingredients.some(item => item.id === "ingredient_pack_rice"), false);
});

test("installing a canonical ingredient without local match keeps the pack ingredient and link", () => {
  const state = createDefaultState();

  mergePackIntoState(state, canonicalPack({
    ingredients: [
      {
        id: "ingredient_pack_basmati",
        name: "Arroz basmati",
        unit: "g",
        canonicalIngredientId: "arroz_basmati",
        canonicalIngredientName: "Arroz basmati",
        canonicalMatchStatus: "confirmed"
      }
    ],
    recipe: [{ ingredientId: "ingredient_pack_basmati", qty: 90, unit: "g" }]
  }));

  const installed = state.ingredients.find(item => item.id === "ingredient_pack_basmati");
  assert.ok(installed);
  assert.equal(installed.canonicalIngredientId, "arroz_basmati");
  assert.equal(installed.canonicalMatchStatus, "confirmed");
  const dish = state.dishes.find(item => item.id === "dish_canonical_test");
  assert.equal(dish.recipe[0].ingredientId, "ingredient_pack_basmati");
});

test("reimporting a canonical pack backfills a missing canonical link on the same local id", () => {
  const state = createDefaultState();
  state.ingredients.push({
    id: "ingredient_pack_rice",
    name: "Arroz redondo",
    familyId: "family_pantry",
    qty: 325,
    unit: "g",
    available: true,
    storageType: "pantry",
    expiryDate: "",
    dateType: "none",
    approxPrice: 1.5,
    packagingType: "otro",
    products: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: 1
  });

  mergePackIntoState(state, canonicalPack({
    ingredients: [
      {
        id: "ingredient_pack_rice",
        name: "Arroz redondo del pack",
        unit: "g",
        canonicalIngredientId: "arroz_redondo",
        canonicalIngredientName: "Arroz redondo",
        canonicalMatchStatus: "confirmed"
      }
    ],
    recipe: [{ ingredientId: "ingredient_pack_rice", qty: 80, unit: "g" }]
  }));

  const installed = state.ingredients.find(item => item.id === "ingredient_pack_rice");
  assert.equal(installed.canonicalIngredientId, "arroz_redondo");
  assert.equal(installed.canonicalIngredientName, "Arroz redondo");
  assert.equal(installed.canonicalMatchStatus, "confirmed");
  assert.equal(installed.qty, 325);
  assert.equal(installed.approxPrice, 1.5);
  assert.equal(installed.name, "Arroz redondo");
});

test("reimporting never overwrites an existing canonical link with a different pack link", () => {
  const state = createDefaultState();
  state.ingredients.push({
    id: "ingredient_pack_rice",
    name: "Arroz local",
    unit: "g",
    products: [],
    canonicalIngredientId: "arroz_integral",
    canonicalIngredientName: "Arroz integral",
    canonicalMatchStatus: "confirmed"
  });

  mergePackIntoState(state, canonicalPack({
    ingredients: [
      {
        id: "ingredient_pack_rice",
        name: "Arroz redondo",
        unit: "g",
        canonicalIngredientId: "arroz_redondo",
        canonicalIngredientName: "Arroz redondo",
        canonicalMatchStatus: "confirmed"
      }
    ],
    recipe: [{ ingredientId: "ingredient_pack_rice", qty: 80, unit: "g" }]
  }));

  const installed = state.ingredients.find(item => item.id === "ingredient_pack_rice");
  assert.equal(installed.canonicalIngredientId, "arroz_integral");
  assert.equal(installed.canonicalIngredientName, "Arroz integral");
});

test("two pack ingredient ids with the same canonical id resolve to one local ingredient", () => {
  const state = createDefaultState();
  const ingredientCountBefore = state.ingredients.length;

  mergePackIntoState(state, canonicalPack({
    ingredients: [
      {
        id: "ingredient_rice_a",
        name: "Arroz redondo A",
        unit: "g",
        canonicalIngredientId: "arroz_redondo",
        canonicalMatchStatus: "confirmed"
      },
      {
        id: "ingredient_rice_b",
        name: "Arroz redondo B",
        unit: "g",
        canonicalIngredientId: "arroz_redondo",
        canonicalMatchStatus: "confirmed"
      }
    ],
    recipe: [
      { ingredientId: "ingredient_rice_a", qty: 40, unit: "g" },
      { ingredientId: "ingredient_rice_b", qty: 40, unit: "g" }
    ]
  }));

  assert.equal(state.ingredients.length, ingredientCountBefore + 1);
  const dish = state.dishes.find(item => item.id === "dish_canonical_test");
  assert.ok(dish);
  assert.equal(dish.recipe[0].ingredientId, dish.recipe[1].ingredientId);
});
