import assert from "node:assert/strict";
import { createDefaultState } from "../models.js";
import { renderDishes, renderRecipeLine } from "../render/dishes.js";

const state = createDefaultState();
const html = renderDishes(state);

assert.match(html, /data-recipe-builder/);
assert.match(html, /name="recipeJson"/);
assert.match(html, /data-action="add-recipe-line"/);
assert.match(html, /data-action="open-recipe-ingredient-picker"/);
assert.doesNotMatch(html, /name="ingredientId_0"/);
assert.doesNotMatch(html, /Ingrediente 6/);

const optionalLine = renderRecipeLine("recipe_line_test", false);
assert.match(optionalLine, /data-recipe-line-id="recipe_line_test"/);
assert.match(optionalLine, /data-action="remove-recipe-line"/);
assert.doesNotMatch(optionalLine, /disabled>Quitar/);

const requiredLine = renderRecipeLine("recipe_line_required", true);
assert.match(requiredLine, /disabled>Quitar/);

console.log("dynamic-recipe-render.test.js OK");
