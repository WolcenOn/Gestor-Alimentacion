import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  }
};

const { parsePreviewIngredientText, summarizeCanonicalCoverage } = await import("../packPricingUiEnhancements.js");

test("parsePreviewIngredientText parses recipe quantities", () => {
  assert.deepEqual(parsePreviewIngredientText("Tomate: 120 g"), { name: "Tomate", amount: 120, unit: "g" });
  assert.deepEqual(parsePreviewIngredientText("Leche entera: 0,25 l"), { name: "Leche entera", amount: 0.25, unit: "l" });
  assert.equal(parsePreviewIngredientText("Texto sin cantidad"), null);
});

test("summarizeCanonicalCoverage keeps ambiguous ingredients unlinked", () => {
  const summary = summarizeCanonicalCoverage([
    "Tomate: 120 g",
    "Cebolla: 30 g",
    "Arroz: 80 g",
    "Leche sin lactosa: 200 ml"
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.canonical, 2);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.requirements.map(item => item.canonicalIngredientId), ["tomate", "cebolla"]);
});

test("summarizeCanonicalCoverage recognizes explicit rice and milk canonicals", () => {
  const summary = summarizeCanonicalCoverage([
    "Arroz basmati: 80 g",
    "Leche semidesnatada sin lactosa: 200 ml"
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.canonical, 2);
  assert.equal(summary.complete, true);
  assert.deepEqual(summary.requirements.map(item => item.canonicalIngredientId), [
    "arroz_basmati",
    "leche_semidesnatada_sin_lactosa"
  ]);
});
