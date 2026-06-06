import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../models.js';
import { computeShoppingListWithProgress } from '../state/shoppingProgress.js';

test('calcula faltantes restando stock y sumando platos por diferentes miembros', () => {
  const state = createDefaultState();
  const items = computeShoppingListWithProgress(state);
  const huevos = items.find(i => i.ingredientId === 'ingredient_huevo');
  assert.equal(huevos.neededQty, 12);
  assert.equal(huevos.stockQty, 4);
  assert.equal(huevos.remainingQty, 8);
});
