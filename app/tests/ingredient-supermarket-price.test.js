import test from "node:test";
import assert from "node:assert/strict";

import { buildIngredientProductsUrl, pickBestIngredientProduct } from "../services/pricesApi.js";

test("builds canonical ingredient products URL with postal code", () => {
  const url = buildIngredientProductsUrl({
    baseUrl: "https://prices-api-production.up.railway.app/api/v1/",
    ingredientId: "arroz_redondo",
    postalCode: "28001"
  });

  assert.equal(
    url,
    "https://prices-api-production.up.railway.app/api/v1/ingredients/arroz_redondo/products?postalCode=28001"
  );
});

test("selects the cheapest available product by unit price without mutating input", () => {
  const items = [
    { product: { name: "B", price: 1.2, pricePerUnit: 2.4, available: true } },
    { product: { name: "A", price: 1.88, pricePerUnit: 1.88, available: true } },
    { product: { name: "Unavailable", price: 1, pricePerUnit: 1, available: false } }
  ];
  const original = structuredClone(items);

  const best = pickBestIngredientProduct(items);

  assert.equal(best.product.name, "A");
  assert.deepEqual(items, original);
});

test("returns null when there is no purchasable priced product", () => {
  assert.equal(pickBestIngredientProduct([]), null);
  assert.equal(pickBestIngredientProduct([{ product: { price: 0, available: true } }]), null);
});
