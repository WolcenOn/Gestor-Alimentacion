import { getState, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { showAlert } from "./render/ui.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { buildUsdaQueries, scoreFoodMatch, isBulkCandidateIngredient } from "./services/foodNameNormalizer.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
const BATCH_CACHE_KEY = "gestorMenuSemanal.nutritionBatch.cache.v1";
const MIN_USDA_SCORE = 35;

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
  root.innerHTML = `<p class="muted">Buscando nutrición para ${ingredients.length} ingrediente(s). Se hará de forma secuencial para no saturar las APIs...</p>`;

  for (let i = 0; i < ingredients.length; i += 1) {
    const ingredient = ingredients[i];
    root.innerHTML = `<p class="muted">Procesando ${i + 1}/${ingredients.length}: ${escapeHtml(ingredient.name)}</p>`;
    const cached = cache[ingredient.id];
    if (cached?.ingredientName === ingredient.name) {
      results[ingredient.id] = cached;
      continue;
    }
    const candidate = await findBestCandidate(ingredient);
    results[ingredient.id] = candidate;
    cache[ingredient.id] = candidate;
    setBatchCache(cache);
  }

  renderNutritionBatchResults(results);
  showAlert("Búsqueda nutricional por lotes completada. Revisa las candidaturas antes de aplicarlas.");
}

async function findBestCandidate(ingredient) {
  const offProduct = (ingredient.products || []).find(product => product.source === "openfoodfacts" && (product.nutriments || product.nutriscore || product.barcode));
  if (offProduct?.nutriments) {
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      status: "ready",
      source: "openfoodfacts",
      score: 95,
      label: `${offProduct.productName || ingredient.name}${offProduct.brand ? ` · ${offProduct.brand}` : ""}`,
      profile: nutritionProfileFromOpenFoodFacts(offProduct, ingredient.id),
      note: "Datos obtenidos del producto asociado en Open Food Facts."
    };
  }

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

  if (!best || bestScore < MIN_USDA_SCORE) {
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      status: "review",
      source: "manual",
      score: Math.max(0, bestScore || 0),
      label: best?.description || "Sin candidato fiable",
      query: bestQuery,
      profile: best ? nutritionProfileFromUsdaFood(best, ingredient.id) : null,
      note: "No se encontró una coincidencia suficientemente fiable. Revisa traducción/nombre antes de aplicar."
    };
  }

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    status: bestScore >= 55 ? "ready" : "review",
    source: "usda-fooddata-central",
    score: bestScore,
    label: best.description || `FDC ${best.fdcId}`,
    query: bestQuery,
    profile: nutritionProfileFromUsdaFood(best, ingredient.id),
    note: `Consulta usada: ${bestQuery}. Revisa si el alimento es crudo/cocido/integral según corresponda.`
  };
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

  showAlert(`Aplicados ${candidates.length} perfiles nutricionales.`);
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
