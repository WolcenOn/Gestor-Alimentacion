import test from "node:test";
import assert from "node:assert/strict";

import { canStartShoppingQuote, pickBestShoppingQuote, summarizeShoppingQuote } from "../services/shoppingQuotes.js";

test("selects cheapest checkout total rather than lowest unit price", () => {
  const items = [
    {
      product: { name: "Leche entera 1 L", price: 0.96, pricePerUnit: 0.96, available: true },
      packageCount: 2,
      purchasedAmount: 2,
      purchasedUnit: "l",
      wasteAmount: 0.8,
      totalCost: 1.92
    },
    {
      product: { name: "Leche entera 3 x 200 ml", price: 0.86, pricePerUnit: 1.43, available: true },
      packageCount: 2,
      purchasedAmount: 1200,
      purchasedUnit: "ml",
      totalCost: 1.72
    }
  ];
  const original = structuredClone(items);

  const best = pickBestShoppingQuote(items);

  assert.equal(best.product.name, "Leche entera 3 x 200 ml");
  assert.equal(best.totalCost, 1.72);
  assert.deepEqual(items, original);
});

test("summarizes package and checkout cost without changing units", () => {
  const summary = summarizeShoppingQuote({
    product: { name: "Leche entera Dia Láctea 1 L", supermarketId: "dia", price: 0.96 },
    packageCount: 2,
    purchasedAmount: 2,
    purchasedUnit: "l",
    wasteAmount: 0.8,
    totalCost: 1.92
  });

  assert.deepEqual(summary, {
    productName: "Leche entera Dia Láctea 1 L",
    supermarket: "DIA",
    packageCount: 2,
    packagePrice: 0.96,
    totalCost: 1.92,
    purchasedAmount: 2,
    purchasedUnit: "l",
    wasteAmount: 0.8
  });
});

test("ignores unavailable or invalid quotes", () => {
  assert.equal(pickBestShoppingQuote([]), null);
  assert.equal(pickBestShoppingQuote([{ product: { available: false }, totalCost: 1 }]), null);
  assert.equal(summarizeShoppingQuote({ product: { price: 0.96 }, packageCount: 0, totalCost: 0 }), null);
});

test("does not restart hydration for terminal quote statuses", () => {
  assert.equal(canStartShoppingQuote(""), true);
  assert.equal(canStartShoppingQuote(undefined), true);
  assert.equal(canStartShoppingQuote("loading"), false);
  assert.equal(canStartShoppingQuote("loaded"), false);
  assert.equal(canStartShoppingQuote("unconfigured"), false);
  assert.equal(canStartShoppingQuote("error"), false);
});
