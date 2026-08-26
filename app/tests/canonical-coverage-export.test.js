import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  baseManifestEntries,
  buildCoverageInput,
  collectPackOccurrences
} from "../../scripts/export-canonical-coverage-input.mjs";

test("baseManifestEntries excludes canonical duplicates", () => {
  const entries = baseManifestEntries([
    { path: "packs/a.json" },
    { path: "packs/canonical/a-canonical.json", canonicalReady: true },
    { path: "packs/b.json", canonicalReady: false }
  ]);
  assert.deepEqual(entries.map(item => item.path), ["packs/a.json", "packs/b.json"]);
});

test("collectPackOccurrences counts recipe uses instead of ingredient declarations", () => {
  const pack = {
    ingredients: [
      { id: "tomate", name: "Tomate" },
      { id: "aceite", name: "Aceite de oliva" }
    ],
    dishes: [
      { id: "d1", recipe: [{ ingredientId: "tomate" }, { ingredientId: "aceite" }] },
      { id: "d2", recipe: [{ ingredientId: "tomate" }] }
    ]
  };
  const result = collectPackOccurrences(pack, "packs/test.json");
  assert.deepEqual(result.map(item => item.name), ["Tomate", "Aceite de oliva", "Tomate"]);
});

test("buildCoverageInput aggregates names and ignores canonical variants", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gestor-coverage-"));
  await mkdir(path.join(root, "packs", "canonical"), { recursive: true });
  await writeFile(path.join(root, "packs", "manifest.json"), JSON.stringify([
    { path: "packs/base.json" },
    { path: "packs/canonical/base-canonical.json", canonicalReady: true }
  ]));
  const basePack = {
    ingredients: [
      { id: "t", name: "Tomate" },
      { id: "a", name: "Aceite" }
    ],
    dishes: [
      { id: "uno", recipe: [{ ingredientId: "t" }, { ingredientId: "a" }] },
      { id: "dos", recipe: [{ ingredientId: "t" }] }
    ]
  };
  await writeFile(path.join(root, "packs", "base.json"), JSON.stringify(basePack));
  await writeFile(path.join(root, "packs", "canonical", "base-canonical.json"), JSON.stringify(basePack));

  const result = await buildCoverageInput(root);
  assert.equal(result.basePacks, 1);
  assert.equal(result.uniqueIngredients, 2);
  assert.equal(result.recipeOccurrences, 3);
  assert.deepEqual(result.ingredients.map(item => [item.name, item.count]), [
    ["Tomate", 2],
    ["Aceite", 1]
  ]);
});
