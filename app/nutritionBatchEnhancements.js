import { getState, updateState } from "./store.js";
import { withMeta } from "./models.js";
import { showAlert } from "./render/ui.js";
import { searchUsdaFoodData, nutritionProfileFromUsdaFood } from "./services/usdaFoodData.js";
import { searchOpenFoodFacts, nutritionProfileFromOpenFoodFacts } from "./services/openFoodFacts.js";
import { buildUsdaQueries, scoreFoodMatch, isBulkCandidateIngredient, normalizeFoodName } from "./services/foodNameNormalizer.js";

const USDA_SESSION_KEY = "gestorMenuSemanal.usdaApiKey.session";
const BATCH_CACHE_KEY = "gestorMenuSemanal.nutritionBatch.cache.v3";
const MIN_USDA_SCORE = 35;
const MIN_OFF_SCORE = 35;

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
    if (button.dataset.action === "apply-nutrition-candidate") {
      event.preventDefault();
      await applySingleCandidate(button.dataset.recordKey, Number(button.dataset.candidateIndex));
    }
    if (button.dataset.action === "mark-nutrition-candidate") {
      event.preventDefault();
      markCandidateAsReady(button.dataset.recordKey, Number(button.dataset.candidateIndex));
    }
    if (button.dataset.action === "ignore-nutrition-record") {
      event.preventDefault();
      ignoreRecord(button.dataset.recordKey);
    }
    if (button.dataset.action === "filter-nutrition-review") {
      event.preventDefault();
      renderNutritionBatchResults(getBatchCache(), button.dataset.filter || "all");
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
    root.innerHTML = `<p class="muted">Procesando ${i + 1}/${ingredients.length}: ${escapeHtml(ingredient.name)}<br><small>Buscando varias coincidencias en Open Food Facts y USDA...</small></p>`;
    const recordKey = `${ingredient.id}:${ingredient.name}:${ingredient.products?.length || 0}`;
    const cached = cache[recordKey];
    if (cached?.ingredientName === ingredient.name) {
      results[recordKey] = cached;
      continue;
    }
    const record = await findCandidateRecord(ingredient, recordKey);
    results[recordKey] = record;
    cache[recordKey] = record;
    setBatchCache(cache);
  }

  renderNutritionBatchResults(results);
  showAlert("Búsqueda nutricional completada. Revisa las coincidencias y aplica la mejor para cada ingrediente.");
}

async function findCandidateRecord(ingredient, recordKey) {
  const candidates = [];
  const seen = new Set();
  const push = candidate => {
    if (!candidate?.profile) return;
    const key = `${candidate.source}:${candidate.sourceId || candidate.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  const associatedOff = (ingredient.products || []).filter(product => product.source === "openfoodfacts" || product.nutriments || product.barcode);
  for (const product of associatedOff) {
    if (product.nutriments || product.nutriscore || product.productName) {
      push(makeCandidate({
        ingredient,
        source: "openfoodfacts",
        sourceId: product.barcode || product.sourceId || "",
        score: product.nutriments ? 96 : 72,
        label: `${product.productName || ingredient.name}${product.brand ? ` · ${product.brand}` : ""}`,
        profile: nutritionProfileFromOpenFoodFacts(product, ingredient.id),
        note: "Producto/código ya asociado al ingrediente. Suele ser fiable si el código corresponde al producto real."
      }));
    }
  }

  const offCandidates = await findOpenFoodFactsCandidates(ingredient);
  offCandidates.forEach(push);
  const usdaCandidates = await findUsdaCandidates(ingredient);
  usdaCandidates.forEach(push);

  candidates.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const best = candidates[0];
  const status = !candidates.length ? "missing" : best.status === "ready" ? "ready" : "review";
  const selectedIndex = status === "ready" ? 0 : -1;

  return {
    recordKey,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    status,
    selectedIndex,
    candidates: candidates.slice(0, 8),
    note: candidates.length
      ? "Revisa si el alimento está crudo, cocido, en conserva, integral o si es un producto de marca."
      : "No se encontraron datos en Open Food Facts ni USDA. Prueba a editar el nombre o asociar un código de barras."
  };
}

function makeCandidate({ ingredient, source, sourceId = "", score = 0, label = "", profile = null, note = "", query = "" }) {
  const profileScore = Number(profile?.kcal || 0) || Number(profile?.carbs || 0) || Number(profile?.protein || 0) || Number(profile?.fat || 0);
  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    status: score >= 58 && profileScore ? "ready" : "review",
    source,
    sourceId,
    score: Math.max(0, Math.round(score)),
    label,
    query,
    profile,
    note
  };
}

async function findOpenFoodFactsCandidates(ingredient) {
  try {
    const products = await searchOpenFoodFacts(ingredient.name, { lang: "es" });
    return (products || [])
      .map(product => {
        const score = scoreOffProduct(product, ingredient.name);
        if (score < MIN_OFF_SCORE) return null;
        return makeCandidate({
          ingredient,
          source: "openfoodfacts",
          sourceId: product.barcode || "",
          score: product.nutriments ? score : score - 10,
          label: `${product.productName || ingredient.name}${product.brand ? ` · ${product.brand}` : ""}`,
          profile: nutritionProfileFromOpenFoodFacts(product, ingredient.id),
          note: `Búsqueda por nombre en Open Food Facts. Revisa marca/producto si el ingrediente es genérico.`
        });
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  } catch {
    return [];
  }
}

async function findUsdaCandidates(ingredient) {
  const apiKey = getUsdaKey();
  const queries = buildUsdaQueries(ingredient.name);
  const candidates = [];
  const seen = new Set();
  for (const query of queries) {
    try {
      const data = await searchUsdaFoodData({ query, apiKey });
      for (const food of data.foods || []) {
        if (seen.has(food.fdcId)) continue;
        seen.add(food.fdcId);
        const score = scoreFoodMatch(food, ingredient.name);
        if (score < MIN_USDA_SCORE) continue;
        candidates.push(makeCandidate({
          ingredient,
          source: "usda-fooddata-central",
          sourceId: String(food.fdcId || ""),
          score,
          label: food.description || `FDC ${food.fdcId}`,
          query,
          profile: nutritionProfileFromUsdaFood(food, ingredient.id),
          note: `Consulta USDA: ${query}. Revisa especialmente si corresponde a crudo/cocido/integral/en conserva.`
        }));
      }
    } catch (error) {
      candidates.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        status: "error",
        source: "usda-fooddata-central",
        sourceId: "",
        score: 0,
        label: "Error consultando USDA",
        query,
        profile: null,
        note: error.message || "Error consultando USDA."
      });
    }
  }
  return candidates
    .filter(candidate => candidate.profile)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
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
  const records = Object.values(cache).filter(record => record.status === "ready" && getSelectedCandidate(record));
  if (!records.length) throw new Error("No hay candidaturas listas para aplicar.");

  updateState(draft => {
    for (const record of records) applyRecordToDraft(draft, record, getSelectedCandidate(record));
  }, "nutrition-batch-apply");

  showAlert(`Aplicados ${records.length} perfiles nutricionales. Revisa la pestaña Nutrición para ver los cálculos.`);
  renderNutritionBatchResults(cache);
}

async function applySingleCandidate(recordKey, candidateIndex) {
  const cache = getBatchCache();
  const record = cache[recordKey];
  const candidate = record?.candidates?.[candidateIndex];
  if (!record || !candidate?.profile) throw new Error("Candidatura no encontrada.");

  updateState(draft => applyRecordToDraft(draft, record, candidate), "nutrition-candidate-apply");
  record.selectedIndex = candidateIndex;
  record.status = "applied";
  record.appliedAt = new Date().toISOString();
  cache[recordKey] = record;
  setBatchCache(cache);
  renderNutritionBatchResults(cache);
  showAlert(`Nutrición aplicada para ${record.ingredientName}.`);
}

function applyRecordToDraft(draft, record, candidate) {
  draft.nutritionProfiles = draft.nutritionProfiles.filter(profile => profile.ingredientId !== record.ingredientId || profile.source !== candidate.profile.source);
  draft.nutritionProfiles.push(withMeta({
    ...candidate.profile,
    sourceName: candidate.label,
    confidenceScore: candidate.score,
    enrichmentNote: candidate.note,
    reviewed: true,
    reviewedAt: new Date().toISOString()
  }, "nutrition"));
}

function markCandidateAsReady(recordKey, candidateIndex) {
  const cache = getBatchCache();
  const record = cache[recordKey];
  const candidate = record?.candidates?.[candidateIndex];
  if (!record || !candidate?.profile) throw new Error("Candidatura no encontrada.");
  record.selectedIndex = candidateIndex;
  record.status = "ready";
  record.candidates = record.candidates.map((item, index) => ({ ...item, status: index === candidateIndex ? "ready" : item.status }));
  cache[recordKey] = record;
  setBatchCache(cache);
  renderNutritionBatchResults(cache);
  showAlert(`Candidatura marcada como fiable para ${record.ingredientName}.`);
}

function ignoreRecord(recordKey) {
  const cache = getBatchCache();
  const record = cache[recordKey];
  if (!record) return;
  record.status = "ignored";
  record.selectedIndex = -1;
  cache[recordKey] = record;
  setBatchCache(cache);
  renderNutritionBatchResults(cache);
  showAlert(`Ingrediente ignorado en esta revisión: ${record.ingredientName}.`);
}

function getSelectedCandidate(record) {
  const index = Number(record?.selectedIndex ?? 0);
  return record?.candidates?.[index >= 0 ? index : 0] || null;
}

function renderNutritionBatchResults(results = getBatchCache(), filter = "all") {
  const root = document.getElementById("nutritionBatchResults");
  if (!root) return;
  const values = Object.entries(results).map(([key, record]) => ({ key, ...record }));
  if (!values.length) {
    root.innerHTML = `<p class="muted">Todavía no hay candidaturas. Lanza una búsqueda por lotes para generarlas.</p>`;
    return;
  }

  const filtered = values.filter(record => filter === "all" || record.status === filter);
  const counts = values.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});

  root.innerHTML = `
    <div class="actions wrap review-filters">
      ${renderFilterButton("all", "Todas", values.length, filter)}
      ${renderFilterButton("ready", "Fiables", counts.ready || 0, filter)}
      ${renderFilterButton("review", "Revisar", counts.review || 0, filter)}
      ${renderFilterButton("missing", "Sin datos", counts.missing || 0, filter)}
      ${renderFilterButton("applied", "Aplicadas", counts.applied || 0, filter)}
      ${renderFilterButton("ignored", "Ignoradas", counts.ignored || 0, filter)}
    </div>
    <div class="list nutrition-review-list">
      ${filtered.length ? filtered.map(record => renderRecord(record.key, record)).join("") : `<p class="muted">No hay elementos en este filtro.</p>`}
    </div>
  `;
}

function renderFilterButton(filter, label, count, activeFilter) {
  return `<button type="button" class="secondary ${filter === activeFilter ? "active-filter" : ""}" data-action="filter-nutrition-review" data-filter="${escapeHtml(filter)}">${escapeHtml(label)} (${count})</button>`;
}

function renderRecord(recordKey, record) {
  const statusLabel = ({ ready: "fiable", review: "revisar", missing: "sin datos", applied: "aplicada", ignored: "ignorada" })[record.status] || record.status;
  return `
    <article class="item nutrition-candidate ${escapeHtml(record.status)}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(record.ingredientName)}</strong>
          <p class="qty-line">${record.candidates?.length || 0} coincidencia(s). ${escapeHtml(record.note || "")}</p>
        </div>
        <span class="badge ${record.status === "ready" || record.status === "applied" ? "" : "warning"}">${escapeHtml(statusLabel)}</span>
      </div>
      ${record.candidates?.length ? `<div class="candidate-options">${record.candidates.map((candidate, index) => renderCandidate(recordKey, record, candidate, index)).join("")}</div>` : `<p class="muted">No hay candidatos. Prueba a cambiar el nombre del ingrediente o asociar un código de barras.</p>`}
      <div class="actions wrap">
        <button type="button" class="secondary" data-action="ignore-nutrition-record" data-record-key="${escapeHtml(recordKey)}">Ignorar por ahora</button>
      </div>
    </article>
  `;
}

function renderCandidate(recordKey, record, candidate, index) {
  const selected = Number(record.selectedIndex) === index;
  const profile = candidate.profile || {};
  return `
    <details class="candidate-option" ${selected ? "open" : ""}>
      <summary>
        <span>
          <strong>${escapeHtml(candidate.label || "Candidato")}</strong>
          <small>${escapeHtml(candidate.source)} · puntuación ${Math.round(candidate.score || 0)}${candidate.query ? ` · ${escapeHtml(candidate.query)}` : ""}</small>
        </span>
        <span class="badge ${candidate.status === "ready" ? "" : "warning"}">${candidate.status === "ready" ? "fiable" : "revisar"}</span>
      </summary>
      <div class="candidate-body">
        <div class="mini-facts">
          <span>${Math.round(profile.kcal || 0)} kcal</span>
          <span>HC ${Number(profile.carbs || 0).toFixed(1)} g</span>
          <span>Azúcares ${Number(profile.sugar || 0).toFixed(1)} g</span>
          <span>Prot. ${Number(profile.protein || 0).toFixed(1)} g</span>
          <span>Grasa ${Number(profile.fat || 0).toFixed(1)} g</span>
          <span>Fibra ${Number(profile.fiber || 0).toFixed(1)} g</span>
        </div>
        <p class="small muted">${escapeHtml(candidate.note || "")}</p>
        <div class="actions wrap">
          <button type="button" data-action="apply-nutrition-candidate" data-record-key="${escapeHtml(recordKey)}" data-candidate-index="${index}">Aplicar esta coincidencia</button>
          <button type="button" class="secondary" data-action="mark-nutrition-candidate" data-record-key="${escapeHtml(recordKey)}" data-candidate-index="${index}">Marcar como fiable</button>
        </div>
      </div>
    </details>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
