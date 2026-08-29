import test from "node:test";
import assert from "node:assert/strict";
import { buildProductSearchUrl } from "../services/pricesApi.js";

test("construye búsqueda de productos no alimentarios por defecto", () => {
  const url = new URL(buildProductSearchUrl({
    baseUrl: "https://prices.example/api/v1/",
    query: " champú familiar ",
    postalCode: "28001"
  }));
  assert.equal(`${url.origin}${url.pathname}`, "https://prices.example/api/v1/products/search");
  assert.equal(url.searchParams.get("q"), "champú familiar");
  assert.equal(url.searchParams.get("postalCode"), "28001");
  assert.equal(url.searchParams.get("scope"), "non_food");
});

test("admite scopes públicos conocidos y rechaza otros", () => {
  const food = new URL(buildProductSearchUrl({
    baseUrl: "https://prices.example/api/v1",
    query: "arroz",
    scope: "food"
  }));
  assert.equal(food.searchParams.get("scope"), "food");
  assert.throws(() => buildProductSearchUrl({
    baseUrl: "https://prices.example/api/v1",
    query: "champú",
    scope: "unknown"
  }), /inválido/);
});
