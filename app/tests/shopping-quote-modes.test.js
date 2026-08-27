import test from "node:test";
import assert from "node:assert/strict";

import { summarizeShoppingQuote } from "../services/shoppingQuotes.js";

test("classifies true granel quotes as variable weight", () => {
  const summary = summarizeShoppingQuote({
    approximate: true,
    totalCost: 1.2,
    purchasedAmount: 0.5,
    purchasedUnit: "kg",
    product: {
      name: "Tomate pera granel",
      supermarketId: "dia",
      variableWeight: true,
      pricePerUnit: 2.4,
      priceUnit: "kg"
    }
  });

  assert.equal(summary.purchaseMode, "variable_weight");
  assert.equal(summary.packageCount, 0);
  assert.equal(summary.approximate, true);
});

test("classifies approximate whole produce as an approximate package", () => {
  const summary = summarizeShoppingQuote({
    approximate: true,
    packageCount: 1,
    purchasedAmount: 1.6,
    purchasedUnit: "kg",
    wasteAmount: 1.48,
    totalCost: 3.18,
    product: {
      name: "Calabaza 1.6 Kg aprox.",
      supermarketId: "dia",
      variableWeight: false,
      price: 3.18,
      pricePerUnit: 1.99,
      priceUnit: "kg"
    }
  });

  assert.equal(summary.purchaseMode, "approximate_package");
  assert.equal(summary.packageCount, 1);
  assert.equal(summary.packagePrice, 3.18);
  assert.equal(summary.totalCost, 3.18);
  assert.equal(summary.approximate, true);
});

test("keeps ordinary fixed packages separate", () => {
  const summary = summarizeShoppingQuote({
    packageCount: 2,
    purchasedAmount: 1000,
    purchasedUnit: "g",
    wasteAmount: 400,
    totalCost: 2.78,
    product: {
      name: "Tomate pera bandeja 500 g",
      supermarketId: "dia",
      variableWeight: false,
      price: 1.39
    }
  });

  assert.equal(summary.purchaseMode, "fixed_package");
  assert.equal(summary.approximate, false);
});
