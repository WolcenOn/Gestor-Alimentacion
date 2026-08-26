import test from "node:test";
import assert from "node:assert/strict";

import { summarizeUnitPrice } from "../services/supermarketPricing.js";

test("summarizes kg price with 100 g reference", () => {
  assert.deepEqual(summarizeUnitPrice({ pricePerUnit: 2.19, priceUnit: "kg", variableWeight: true }), {
    pricePerUnit: 2.19,
    priceUnit: "kg",
    referenceAmount: 100,
    referenceUnit: "g",
    referencePrice: 0.219,
    variableWeight: true
  });
});

test("summarizes litre price with 100 ml reference", () => {
  const result = summarizeUnitPrice({ pricePerUnit: 1.5, priceUnit: "l" });
  assert.equal(result.referenceAmount, 100);
  assert.equal(result.referenceUnit, "ml");
  assert.equal(result.referencePrice, 0.15);
});

test("returns null without usable unit price", () => {
  assert.equal(summarizeUnitPrice({ pricePerUnit: 0, priceUnit: "kg" }), null);
  assert.equal(summarizeUnitPrice({ pricePerUnit: 2 }), null);
});
