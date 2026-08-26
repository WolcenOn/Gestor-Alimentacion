import test from "node:test";
import assert from "node:assert/strict";

import { adaptPackToKnownCanonicals, canonicalForPackIngredient } from "../services/packLoader.js";

test("canonical pack mapping only links explicit safe ingredient concepts", () => {
  assert.deepEqual(canonicalForPackIngredient({ name: "Tomates cherry" }), { id: "tomate", name: "Tomate" });
  assert.deepEqual(canonicalForPackIngredient({ name: "Pimiento rojo crudo" }), { id: "pimiento", name: "Pimiento" });
  assert.deepEqual(canonicalForPackIngredient({ name: "Leche semidesnatada sin lactosa" }), { id: "leche_semidesnatada_sin_lactosa", name: "Leche semidesnatada sin lactosa" });
  assert.equal(canonicalForPackIngredient({ name: "Tomate seco" }), null);
  assert.equal(canonicalForPackIngredient({ name: "Semillas de calabaza" }), null);
  assert.equal(canonicalForPackIngredient({ name: "Arroz" }), null);
  assert.equal(canonicalForPackIngredient({ name: "Leche sin lactosa" }), null);
});

test("adapted pack gets distinct ids and confirmed links without changing recipe ingredient ids", () => {
  const adapted = adaptPackToKnownCanonicals({
    id: "pack_demo",
    name: "Pack demo",
    tags: ["demo"],
    ingredients: [
      { id: "ingredient_tomate", name: "Tomate", unit: "g" },
      { id: "ingredient_tomate_seco", name: "Tomate seco", unit: "g" }
    ],
    dishes: [
      {
        id: "dish_demo",
        name: "Plato demo",
        servings: 1,
        recipe: [
          { ingredientId: "ingredient_tomate", qty: 100, unit: "g" },
          { ingredientId: "ingredient_tomate_seco", qty: 10, unit: "g" }
        ]
      }
    ]
  });

  assert.equal(adapted.id, "pack_demo_canonical");
  assert.equal(adapted.dishes[0].id, "dish_demo_canonical");
  assert.equal(adapted.dishes[0].recipe[0].ingredientId, "ingredient_tomate");
  assert.equal(adapted.ingredients[0].canonicalIngredientId, "tomate");
  assert.equal(adapted.ingredients[0].canonicalMatchStatus, "confirmed");
  assert.equal(adapted.ingredients[1].canonicalIngredientId, undefined);
});
