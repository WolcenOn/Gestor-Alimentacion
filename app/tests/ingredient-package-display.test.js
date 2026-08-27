import test from "node:test";
import assert from "node:assert/strict";

import { packageDisplayInfo } from "../render/ingredientCard.js";

const ingredient = {
  id: "tomates_cherry",
  name: "tomates cherry",
  unit: "g",
  products: [{ packageQty: 300, packageUnit: "g", packageCount: 1, lastPurchasedQty: 160, lastPurchasedUnit: "g" }]
};

test("uses a real purchase lot as last purchase history", () => {
  const info = packageDisplayInfo({
    purchaseLots: [{
      ingredientId: "tomates_cherry",
      packageCount: 2,
      packageSizeQty: 300,
      packageSizeUnit: "g",
      qty: 600,
      unit: "g",
      createdAt: "2026-08-27T12:00:00Z"
    }]
  }, ingredient);

  assert.deepEqual(info, {
    label: "Última compra",
    text: "2 envase(s) × 300 g = 600 g",
    source: "purchase_lot"
  });
});

test("labels product package metadata as configuration when there is no purchase lot", () => {
  const info = packageDisplayInfo({ purchaseLots: [] }, ingredient);

  assert.deepEqual(info, {
    label: "Envase configurado",
    text: "1 envase(s) × 300 g = 300 g",
    source: "product_configuration"
  });
});

test("does not present lastPurchasedQty as proof of a real purchase", () => {
  const info = packageDisplayInfo({ purchaseLots: [] }, ingredient);

  assert.equal(info.text.includes("160 g"), false);
  assert.equal(info.label, "Envase configurado");
});

test("returns null when neither purchase history nor package configuration exists", () => {
  const info = packageDisplayInfo({ purchaseLots: [] }, {
    id: "sin_envase",
    unit: "g",
    products: [{}]
  });

  assert.equal(info, null);
});
