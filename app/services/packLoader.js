import { assertSafePackPath, validatePack } from "../validation.js";

export const PACK_SOURCE = Object.freeze({
  owner: "WolcenOn",
  repo: "GestorMenuSemanal",
  branch: "main",
  basePath: "packs"
});

const GITHUB_API = "https://api.github.com";

export async function listRemotePacks() {
  const root = `${GITHUB_API}/repos/${PACK_SOURCE.owner}/${PACK_SOURCE.repo}/contents/${PACK_SOURCE.basePath}?ref=${PACK_SOURCE.branch}`;
  const files = [];
  await walk(root, files);
  return files.filter(f => f.path.endsWith(".json") && !f.path.includes(".."));
}

async function walk(url, files) {
  const response = await fetch(url, { headers: { "Accept": "application/vnd.github+json" } });
  if (!response.ok) throw new Error("No se pudieron listar los packs remotos.");
  const entries = await response.json();
  for (const entry of entries) {
    if (entry.type === "dir") await walk(entry.url, files);
    if (entry.type === "file" && entry.path.endsWith(".json")) files.push({ name: entry.name, path: entry.path, downloadUrl: entry.download_url });
  }
}

export async function loadRemotePack(file) {
  const relativePath = file.path.replace(`${PACK_SOURCE.basePath}/`, "");
  assertSafePackPath(relativePath);
  const response = await fetch(file.downloadUrl, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("No se pudo descargar el pack.");
  const text = await response.text();
  if (/javascript:|<\s*script/gi.test(text)) throw new Error("Pack potencialmente inseguro.");
  const pack = JSON.parse(text);
  validatePack(pack);
  return pack;
}

export function mergePackIntoState(state, pack) {
  validatePack(pack);
  const existingIngredientIds = new Set(state.ingredients.map(i => i.id));
  const existingDishIds = new Set(state.dishes.map(d => d.id));
  for (const ingredient of pack.ingredients) {
    if (!existingIngredientIds.has(ingredient.id)) state.ingredients.push(ingredient);
  }
  for (const dish of pack.dishes) {
    if (!existingDishIds.has(dish.id)) state.dishes.push({ ...dish, packId: pack.id || pack.name });
  }
  if (!state.dishPacks.some(p => p.id === (pack.id || pack.name))) {
    state.dishPacks.push({ id: pack.id || pack.name, name: pack.name, description: pack.description || "", tags: pack.tags || [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: 1 });
  }
}
