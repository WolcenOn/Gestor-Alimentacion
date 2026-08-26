import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function baseManifestEntries(manifest) {
  if (!Array.isArray(manifest)) throw new Error("packs/manifest.json must contain an array");
  return manifest.filter(entry => {
    const packPath = String(entry?.path || "").trim();
    return packPath.endsWith(".json") &&
      !entry?.canonicalReady &&
      !packPath.startsWith("packs/canonical/");
  });
}

export function collectPackOccurrences(pack, source = "") {
  const ingredients = new Map(
    (Array.isArray(pack?.ingredients) ? pack.ingredients : [])
      .filter(item => String(item?.id || "").trim() && String(item?.name || "").trim())
      .map(item => [String(item.id), String(item.name).trim()])
  );

  const occurrences = [];
  for (const dish of Array.isArray(pack?.dishes) ? pack.dishes : []) {
    for (const line of Array.isArray(dish?.recipe) ? dish.recipe : []) {
      const name = ingredients.get(String(line?.ingredientId || ""));
      if (!name) continue;
      occurrences.push({
        name,
        source: [source, String(dish?.id || dish?.name || "").trim()].filter(Boolean).join("#")
      });
    }
  }
  return occurrences;
}

export async function buildCoverageInput(rootDir) {
  const manifestPath = path.join(rootDir, "packs", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entries = baseManifestEntries(manifest);
  const aggregate = new Map();

  for (const entry of entries) {
    const relativePath = String(entry.path).replace(/^\.\//, "");
    const fullPath = path.join(rootDir, relativePath);
    const pack = JSON.parse(await readFile(fullPath, "utf8"));
    for (const occurrence of collectPackOccurrences(pack, relativePath)) {
      const key = normalizeKey(occurrence.name);
      if (!key) continue;
      const current = aggregate.get(key) || {
        name: occurrence.name,
        count: 0,
        sources: new Set()
      };
      current.count += 1;
      if (occurrence.source) current.sources.add(occurrence.source);
      aggregate.set(key, current);
    }
  }

  const ingredients = [...aggregate.values()]
    .map(item => ({
      name: item.name,
      count: item.count,
      source: [...item.sources].sort().join(",")
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  return {
    generatedFrom: "Gestor-Alimentacion/packs/manifest.json",
    basePacks: entries.length,
    uniqueIngredients: ingredients.length,
    recipeOccurrences: ingredients.reduce((sum, item) => sum + item.count, 0),
    ingredients
  };
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), "..");
  const outputArg = process.argv[2];
  const report = await buildCoverageInput(repoRoot);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputArg) {
    const outputPath = path.resolve(process.cwd(), outputArg);
    await writeFile(outputPath, json, "utf8");
    console.error(`Canonical coverage input written to ${outputPath}`);
  } else {
    process.stdout.write(json);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
