import test from "node:test";
import assert from "node:assert/strict";

import { collectCanonicalPackRequirements, normalizeRequirementQuantity } from "../services/packPricing.js";
import { buildIngredientQuoteUrl } from "../services/pricesApi.js";

test("normalizes compatible recipe units for price quotes", () => {
  assert.deepEqual(normalizeRequirementQuantity(1.2, "kg"), { amount: 1200, unit: "g" });
  assert.deepEqual(normalizeRequirementQuantity(0.75, "l"), { amount: 750, unit: "ml" });
});

test("aggregates canonical ingredient quantities across a pack", () => {
  const pack = {
    ingredients: [
      {
        id: "ingredient_arroz_demo",
        name: "Arroz redondo",
        canonicalIngredientId: "arroz_redondo",
        canonicalIngredientName: "Arroz redondo"
      }
    ],
    dishes: [
      { id: "dish_a", recipe: [{ ingredientId: "ingredient_arroz_demo", qty: 200, unit: "g" }] },
      { id: "dish_b", recipe: [{ ingredientId: "ingredient_arroz_demo", qty: 0.18, unit: "kg" }] },
      { id: "dish_c", recipe: [{ ingredientId: "ingredient_arroz_demo", qty: 220, unit: "g" }] }
    ]
  };

  assert.deepEqual(collectCanonicalPackRequirements(pack), [
    {
      canonicalIngredientId: "arroz_redondo",
      canonicalIngredientName: "Arroz redondo",
      amount: 600,
      unit: "g"
    }
  ]);
});

test("can aggregate only selected dishes", () => {
  const pack = {
    ingredients: [
      { id: "ingredient_arroz", name: "Arroz", canonicalIngredientId: "arroz_redondo" }
    ],
    dishes: [
      { id: "dish_a", recipe: [{ ingredientId: "ingredient_arroz", qty: 200, unit: "g" }] },
      { id: "dish_b", recipe: [{ ingredientId: "ingredient_arroz", qty: 180, unit: "g" }] }
    ]
  };

  const requirements = collectCanonicalPackRequirements(pack, ["dish_b"]);
  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].amount, 180);
});

test("builds the canonical ingredient quote endpoint", () => {
  const url = buildIngredientQuoteUrl({
    baseUrl: "https://prices.example.test/api/v1/",
    ingredientId: "arroz_redondo",
    amount: 600,
    unit: "g",
    postalCode: "28001"
  });

  assert.equal(
    url,
    "https://prices.example.test/api/v1/ingredients/arroz_redondo/quote?amount=600&unit=g&postalCode=28001"
  );
});
