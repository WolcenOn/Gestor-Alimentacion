import test from "node:test";
import assert from "node:assert/strict";
import { buildIngredientSearchUrl, buildProductSearchUrl } from "../services/pricesApi.js";

test("buildProductSearchUrl encodes query and postal code", () => {
  assert.equal(
    buildProductSearchUrl({
      baseUrl: "https://prices.example/api/v1/",
      query: "tomate pera",
      postalCode: "28001"
    }),
    "https://prices.example/api/v1/products/search?q=tomate+pera&postalCode=28001"
  );
});

test("buildIngredientSearchUrl searches canonical ingredients", () => {
  assert.equal(
    buildIngredientSearchUrl({
      baseUrl: "https://prices.example/api/v1",
      query: "leche desnatada"
    }),
    "https://prices.example/api/v1/ingredients/search?q=leche+desnatada"
  );
});

test("search builders reject empty queries", () => {
  assert.throws(
    () => buildProductSearchUrl({ baseUrl: "https://prices.example/api/v1", query: " " }),
    /Escribe un producto/
  );
  assert.throws(
    () => buildIngredientSearchUrl({ baseUrl: "https://prices.example/api/v1", query: "" }),
    /Escribe un ingrediente canonical/
  );
});
