import test from "node:test";
import assert from "node:assert/strict";

import { adaptPackToKnownCanonicals } from "../services/packLoader.js";

test("canonical-ready adaptation assigns safe canonical links and independent ids", () => {
  const input = {
    id: "pack_demo",
    name: "Pack demo",
    tags: [],
    ingredients: [
      { id: "ingredient_tomate", name: "Tomate", unit: "g" },
      { id: "ingredient_arroz", name: "Arroz", unit: "g" }
    ],
    dishes: [
      {
        id: "dish_demo",
        name: "Plato demo",
        servings: 1,
        recipe: [
          { ingredientId: "ingredient_tomate", qty: 100, unit: "g" },
          { ingredientId: "ingredient_arroz", qty: 80, unit: "g" }
        ]
      }
    ]
  };

  const adapted = adaptPackToKnownCanonicals(input);

  assert.equal(adapted.id, "pack_demo_canonical");
  assert.equal(adapted.dishes[0].id, "dish_demo_canonical");
  assert.equal(adapted.ingredients[0].canonicalIngredientId, "tomate");
  assert.equal(adapted.ingredients[0].canonicalMatchStatus, "confirmed");
  assert.equal(adapted.ingredients[1].canonicalIngredientId, undefined);
});
