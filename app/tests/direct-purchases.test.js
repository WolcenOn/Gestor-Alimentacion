import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState } from "../models.js";
import {
  addDirectPurchase,
  directPurchasesForWeek,
  directPurchaseSubtotal,
  removeDirectPurchase,
  setDirectPurchaseQuantity
} from "../state/directPurchases.js";

const shampoo = {
  id: "product-shampoo",
  supermarketId: "dia",
  externalId: "12345",
  name: "Champú familiar 500 ml",
  packageAmount: 500,
  packageUnit: "ml",
  price: 3.95,
  available: true
};

test("añade un SKU no alimentario por unidades y calcula su subtotal", () => {
  const state = createDefaultState();
  addDirectPurchase(state, { product: shampoo, quantity: 2 });
  const items = directPurchasesForWeek(state);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].productId, shampoo.id);
  assert.equal(directPurchaseSubtotal(state), 7.9);
});

test("acumula unidades del mismo SKU dentro de la misma semana", () => {
  const state = createDefaultState();
  addDirectPurchase(state, { product: shampoo, quantity: 1 });
  addDirectPurchase(state, { product: shampoo, quantity: 2 });
  assert.equal(directPurchasesForWeek(state).length, 1);
  assert.equal(directPurchasesForWeek(state)[0].quantity, 3);
});

test("mantiene separadas las compras directas de semanas diferentes", () => {
  const state = createDefaultState();
  addDirectPurchase(state, { product: shampoo, quantity: 1, weekId: "week-a" });
  addDirectPurchase(state, { product: shampoo, quantity: 2, weekId: "week-b" });
  assert.equal(directPurchasesForWeek(state, "week-a")[0].quantity, 1);
  assert.equal(directPurchasesForWeek(state, "week-b")[0].quantity, 2);
});

test("permite cambiar unidades y quitar el producto", () => {
  const state = createDefaultState();
  const item = addDirectPurchase(state, { product: shampoo, quantity: 1 });
  setDirectPurchaseQuantity(state, item.id, 4);
  assert.equal(directPurchaseSubtotal(state), 15.8);
  removeDirectPurchase(state, item.id);
  assert.equal(directPurchasesForWeek(state).length, 0);
});

test("rechaza cantidades no enteras o no positivas", () => {
  const state = createDefaultState();
  assert.throws(() => addDirectPurchase(state, { product: shampoo, quantity: 0 }), /entero mayor que cero/);
  assert.throws(() => addDirectPurchase(state, { product: shampoo, quantity: 1.5 }), /entero mayor que cero/);
});
