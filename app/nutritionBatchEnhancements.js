import { getState, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { showAlert } from "./render/ui.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { searchOpenFoodFacts, nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { buildUsdaQueries, scoreFoodMatch, isBulkCandidateIngredient, normalizeFoodName } from "./services/foodNameNormalizer.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
const BATCH_CACHE_KEY = "gestorMenuSemanal.nutritionBatch.cache.v2";
const MIN_USDA_SCORE = 35;
const MIN_OFF_SCORE = 42;

function getUsdaKey() {
  return sessionStorage.getItem(USDA_SESSION_KEY) || "DEMO_KEY";
}

function getBatchCache() {
  try { return JSON.parse(localStorage.getItem(BATCH_CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function setBatchCache(cache) {
  localStorage.setItem(BATCH_CACHE_KEY, JSON.stringify(cache));
}

function candidateIngredients() {
  const state = getState();
  return state.ingredients.filter(ingredient => isBulkCandidateIngredient(ingredient, state.nutritionProfiles));
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  try {
    if (button.dataset.action === "scan-bulk-nutrition") {
      event.preventDefault();
      await scanNutritionCandidates();
    }
    if (button.dataset.action === "apply-bulk-nutrition") {
      event.preventDefault();
      await applyNutritionCandidates();
    }
    if (button.dataset.action === "clear-bulk-nutrition-cache") {
      event.preventDefault();
      localStorage.removeItem(BATCH_CACHE_KEY);
      renderNutritionBatchResults({});
      showAlert("Candidaturas nutricionales borradas.");
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo completar el enriquecimiento nutricional.", "error");
  }
}, true);

async function scanNutritionCandidates() {
  const ingredients = candidateIngredients();
  const root = document.getElementById("nutritionBatchResults");
  if (!root) return;
  if (!ingredients.length) {
    root.innerHTML = `<p class="muted">No hay ingredientes pendientes de nutrición.</p>`;
    return;
  }

  const cache = getBatchCache();
  const results = {};
  root.innerHTML = `<p class="muted">Buscando nutrición para ${ingredients.length} ingrediente(s). Se consultará Open Food Facts y USDA de forma secuencial para no saturar las APIs...</p>`;

  for (let i = 0; i < ingredients.length; i += 1) {
    const ingredient = ingredients[i];
    root.innerHTML = `<p class="muted">Procesando ${i + 1}/${ingredients.length}: ${escapeHtml(ingredient.name)}<br><small>Buscando en Open Food Facts y USDA...</small></p>`;
    const cacheKey = `${ingredient.id}:${ingredient.name}:${ingredient.products?.length || 0}`;
    const cached = cache[cacheKey];
    if (cached?.ingredientName === ingredient.name) {
      results[cacheKey] = cached;
      continue;
    }
    const candidate = await findBestCandidate(ingredient);
    results[cacheKey] = candidate;
    cache[cacheKey] = candidate;
    setBatchCache(cache);
  }

  renderNutritionBatchResults(results);
  showAlert("Búsqueda nutricional por lotes completada. Revisa las candidaturas antes de aplicarlas.");
}

async function findBestCandidate(ingredient) {
  const candidates = [];
  const associatedOff = (ingredient.products || []).filter(product => product.source === "openfoodfacts" || product.nutriments || product.barcode);
  for (const product of associatedOff) {
    if (product.nutriments || product.nutriscore || product.productName) {
      candidates.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        status: "ready",
        source: "openfoodfacts",
        score: product.nutriments ? 96 : 72,
        label: `${product.productName || ingredient.name}${product.brand ? ` · ${product.brand}` : ""}`,
        profile: nutritionProfileFromOpenFoodFacts(product, ingredient.id),
        note: "Datos obtenidos del producto/código asociado en Open Food Facts."
      });
    }
  }

  const offCandidate = await findOpenFoodFactsByName(ingredient);
  if (offCandidate) candidates.push(offCandidate);

  const usdaCandidate = await findUsdaByName(ingredient);
  if (usdaCandidate) candidates.push(usdaCandidate);

  const best = candidates.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!best) {
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      status: "review",
      source: "manual",
      score: 0,
      label: "Sin candidato fiable",
      profile: null,
      note: "No se encontraron datos en Open Food Facts ni USDA. Prueba a editar el nombre o asociar un código de barras."
    };
  }
  return best;
}

async function findOpenFoodFactsByName(ingredient) {
  try {
    const products = await searchOpenFoodFacts(ingredient.name, { lang: "es" });
    let best = null;
    let bestScore = -Infinity;
    for (const product of products || []) {
      const score = scoreOffProduct(product, ingredient.name);
      if (score > bestScore) {
        best = product;
        bestScore = score;
      }
    }
    if (!best || bestScore < MIN_OFF_SCORE) return null;
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      status: bestScore >= 58 && best.nutriments ? "ready" : "review",
      source: "openfoodfacts",
      score: best.nutriments ? bestScore : bestScore - 10,
      label: `${best.productName || ingredient.name}${best.brand ? ` · ${best.brand}` : ""}`,
      profile: nutritionProfileFromOpenFoodFacts(best, ingredient.id),
      note: `Búsqueda por nombre en Open Food Facts. Revisa marca/producto si es un alimento genérico.`
    };
  } catch {
    return null;
  }
}

async function findUsdaByName(ingredient) {
  const apiKey = getUsdaKey();
  const queries = buildUsdaQueries(ingredient.name);
  let best = null;
  let bestScore = -Infinity;
  let bestQuery = "";
  for (const query of queries) {
    try {
      const data = await searchUsdaFoodData({ query, apiKey });
      for (const food of data.foods || []) {
        const score = scoreFoodMatch(food, ingredient.name);
        if (score > bestScore) {
          best = food;
          bestScore = score;
          bestQuery = query;
        }
      }
      if (bestScore >= 70) break;
    } catch (error) {
      return {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        status: "error",
        source: "usda-fooddata-central",
        score: 0,
        label: "",
        profile: null,
        note: error.message || "Error consultando USDA."
      };
    }
  }
  if (!best || bestScore < MIN_USDA_SCORE) return null;
  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    status: bestScore >= 55 ? "ready" : "review",
    source: "usda-fooddata-central",
    score: bestScore,
    label: best.description || `FDC ${best.fdcId}`,
    query: bestQuery,
    profile: nutritionProfileFromUsdaFood(best, ingredient.id),
    note: `Consulta USDA usada: ${bestQuery}. Revisa crudo/cocido/integral antes de usarlo para decisiones finas.`
  };
}

function scoreOffProduct(product, ingredientName) {
  const target = normalizeFoodName(ingredientName);
  const text = normalizeFoodName([product.productName, product.genericName, product.brand, product.categories].join(" "));
  let score = 0;
  if (text.includes(target)) score += 55;
  for (const word of target.split(" ").filter(w => w.length > 2)) if (text.includes(word)) score += 12;
  if (product.nutriments && Object.keys(product.nutriments).length) score += 18;
  if (product.packageQty) score += 4;
  if (/bio|eco|organic/.test(text)) score += 1;
  if (/sabor|flavour|aroma|bebida|snack|galleta|postre/.test(text) && !target.includes("yogur")) score -= 8;
  return score;
}

async function applyNutritionCandidates() {
  const cache = getBatchCache();
  const candidates = Object.values(cache).filter(candidate => candidate.status === "ready" && candidate.profile);
  if (!candidates.length) throw new Error("No hay candidaturas listas para aplicar.");

  updateState(draft => {
    for (const candidate of candidates) {
      draft.nutritionProfiles = draft.nutritionProfiles.filter(profile => profile.ingredientId !== candidate.ingredientId || profile.source !== candidate.profile.source);
      draft.nutritionProfiles.push(withMeta({
        ...candidate.profile,
        sourceName: candidate.label,
        confidenceScore: candidate.score,
        enrichmentNote: candidate.note
      }, "nutrition"));
    }
  }, "nutrition-batch-apply");

  showAlert(`Aplicados ${candidates.length} perfiles nutricionales. Revisa la pestaña Nutrición para ver los cálculos.`);
  renderNutritionBatchResults(cache);
}

function renderNutritionBatchResults(results = getBatchCache()) {
  const root = document.getElementById("nutritionBatchResults");
  if (!root) return;
  const values = Object.values(results);
  if (!values.length) {
    root.innerHTML = `<p class="muted">Todavía no hay candidaturas. Lanza una búsqueda por lotes para generarlas.</p>`;
    return;
  }

  root.innerHTML = values.map(candidate => `
    <div class="item nutrition-candidate ${candidate.status}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(candidate.ingredientName)}</strong>
          <p class="qty-line">${escapeHtml(candidate.label || "Sin candidato")} · ${escapeHtml(candidate.source || "")}</p>
        </div>
        <span class="badge ${candidate.status === "ready" ? "" : "warning"}">${candidate.status === "ready" ? "lista" : candidate.status}</span>
      </div>
      ${candidate.profile ? `<div class="mini-facts"><span>${Math.round(candidate.profile.kcal || 0)} kcal</span><span>Prot. ${Number(candidate.profile.protein || 0).toFixed(1)} g</span><span>HC ${Number(candidate.profile.carbs || 0).toFixed(1)} g</span><span>Grasa ${Number(candidate.profile.fat || 0).toFixed(1)} g</span></div>` : ""}
      <p class="small muted">Puntuación: ${Math.round(candidate.score || 0)} · ${escapeHtml(candidate.note || "")}</p>
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
