import test from "node:test";
import assert from "node:assert/strict";

import { canonicalForPackIngredient, normalizeCanonicalReadyPack } from "../services/canonicalPackBridge.js";

test("canonical bridge links safe names but leaves generic rice unlinked", () => {
  assert.deepEqual(canonicalForPackIngredient({ name: "Tomate" }), { id: "tomate", name: "Tomate" });
  assert.equal(canonicalForPackIngredient({ name: "Arroz" }), null);
});

test("canonical normalization preserves simplified UX meal types", () => {
  const pack = normalizeCanonicalReadyPack({
    schemaVersion: 2,
    type: "meal-pack",
    id: "pack_demo",
    name: "Demo",
    ingredients: [
      { id: "ingredient_tomate", name: "Tomate", unit: "g" },
      { id: "ingredient_arroz", name: "Arroz", unit: "g" }
    ],
    dishes: [{
      id: "dish_demo",
      name: "Tomate con arroz",
      servings: 1,
      mealTypes: ["Comida", "Cena"],
      recipe: [
        { ingredientId: "ingredient_tomate", qty: 150, unit: "g" },
        { ingredientId: "ingredient_arroz", qty: 80, unit: "g" }
      ]
    }]
  });

  assert.equal(pack.id, "pack_demo_canonical");
  assert.equal(pack.dishes[0].id, "dish_demo_canonical");
  assert.deepEqual(pack.dishes[0].mealTypes, ["Comida", "Cena"]);

  const tomato = pack.ingredients.find(item => item.id === "ingredient_tomate");
  const rice = pack.ingredients.find(item => item.id === "ingredient_arroz");
  assert.equal(tomato.canonicalIngredientId, "tomate");
  assert.equal(tomato.canonicalMatchStatus, "confirmed");
  assert.equal(rice.canonicalIngredientId, undefined);
});
