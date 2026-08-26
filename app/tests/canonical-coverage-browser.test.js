import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCoverageOccurrences,
  baseManifestEntries,
  buildCoverageReport,
  collectPackOccurrences
} from "../services/canonicalCoverage.js";
import { buildCanonicalResolveBatchUrl } from "../services/pricesApi.js";

test("baseManifestEntries excludes canonical duplicate packs", () => {
  const entries = baseManifestEntries([
    { path: "packs/base.json" },
    { path: "packs/canonical/base-canonical.json", canonicalReady: true },
    { path: "README.md" }
  ]);
  assert.deepEqual(entries.map(item => item.path), ["packs/base.json"]);
});

test("collectPackOccurrences and aggregate count recipe usage", () => {
  const pack = {
    ingredients: [
      { id: "i1", name: "Tomate" },
      { id: "i2", name: "Pechuga de pollo" }
    ],
    dishes: [
      { id: "d1", recipe: [{ ingredientId: "i1" }, { ingredientId: "i2" }] },
      { id: "d2", recipe: [{ ingredientId: "i1" }] }
    ]
  };
  const items = aggregateCoverageOccurrences(collectPackOccurrences(pack, "packs/base.json"));
  assert.equal(items[0].name, "Tomate");
  assert.equal(items[0].count, 2);
  assert.equal(items[1].count, 1);
});

test("coverage report only counts exact and verified aliases as resolved", () => {
  const inputs = [
    { name: "Tomate", count: 5, sources: [] },
    { name: "Espinacas", count: 3, sources: [] },
    { name: "Arroz blanco", count: 2, sources: [] },
    { name: "Pechuga de pollo", count: 4, sources: [] }
  ];
  const resolutions = [
    { status: "verified", normalizedQuery: "tomate", candidates: [{ matchType: "canonical_name", confidence: 1, ingredient: { id: "tomate", name: "Tomate" } }] },
    { status: "verified", normalizedQuery: "espinacas", candidates: [{ matchType: "alias", confidence: 0.99, ingredient: { id: "espinaca", name: "Espinaca" } }] },
    { status: "suggested", normalizedQuery: "arroz blanco", candidates: [{ matchType: "alias", confidence: 0.8, ingredient: { id: "arroz_redondo", name: "Arroz redondo" } }] },
    { status: "unresolved", normalizedQuery: "pechuga de pollo", candidates: [] }
  ];
  const report = buildCoverageReport(inputs, resolutions);
  assert.equal(report.summary.resolvedUnique, 2);
  assert.equal(report.summary.resolvedOccurrences, 8);
  assert.equal(report.summary.totalOccurrences, 14);
  assert.equal(report.summary.suggestedAlias, 1);
  assert.equal(report.summary.unresolved, 1);
  assert.equal(report.items[0].name, "Pechuga de pollo");
});

test("batch resolver URL preserves repeated q parameters", () => {
  const url = buildCanonicalResolveBatchUrl({
    baseUrl: "https://prices.example/api/v1/",
    queries: ["tomate", "pechuga de pollo", "arroz blanco"]
  });
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/api/v1/ingredients/resolve");
  assert.deepEqual(parsed.searchParams.getAll("q"), ["tomate", "pechuga de pollo", "arroz blanco"]);
});

test("batch resolver URL rejects more than 100 queries", () => {
  assert.throws(() => buildCanonicalResolveBatchUrl({
    baseUrl: "https://prices.example/api/v1",
    queries: Array.from({ length: 101 }, (_, index) => `ingrediente ${index}`)
  }), /100 ingredientes/);
});
