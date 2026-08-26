import test from "node:test";
import assert from "node:assert/strict";

import { ingredientConsumedCost, summarizeDishConsumedCost } from "../services/dishPricing.js";
import { collectCanonicalDishRequirements } from "../services/packPricing.js";

test("calculates consumed cost from grams and euros per kg", () => {
  const cost = ingredientConsumedCost(
    { amount: 150, unit: "g" },
    { pricePerUnit: 2.19, priceUnit: "kg" }
  );
  assert.equal(cost, 0.33);
});

test("calculates consumed cost from millilitres and euros per litre", () => {
  const cost = ingredientConsumedCost(
    { amount: 250, unit: "ml" },
    { pricePerUnit: 1.2, priceUnit: "l" }
  );
  assert.equal(cost, 0.3);
});

test("reports partial coverage instead of inventing missing ingredient prices", () => {
  const requirements = [
    { canonicalIngredientId: "tomate", amount: 150, unit: "g" },
    { canonicalIngredientId: "cebolla", amount: 50, unit: "g" }
  ];
  const products = new Map([
    ["tomate", { pricePerUnit: 2.19, priceUnit: "kg" }]
  ]);

  const summary = summarizeDishConsumedCost(requirements, products, 3);
  assert.deepEqual(summary, {
    totalCost: 0.33,
    pricedIngredients: 1,
    canonicalIngredients: 2,
    totalIngredients: 3,
    complete: false
  });
});

test("collects only canonical recipe lines for per-serving pricing", () => {
  const dish = {
    recipe: [
      { ingredientId: "i_tomate", qty: 120, unit: "g" },
      { ingredientId: "i_aceite", qty: 10, unit: "ml" }
    ]
  };
  const ingredients = new Map([
    ["i_tomate", { name: "Tomate", canonicalIngredientId: "tomate", canonicalIngredientName: "Tomate" }],
    ["i_aceite", { name: "Aceite" }]
  ]);

  assert.deepEqual(collectCanonicalDishRequirements(dish, ingredients), [
    { canonicalIngredientId: "tomate", canonicalIngredientName: "Tomate", amount: 120, unit: "g" }
  ]);
});
