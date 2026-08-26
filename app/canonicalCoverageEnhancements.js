import { showAlert } from "./render/ui.js";
import {
  aggregateCoverageOccurrences,
  baseManifestEntries,
  buildCoverageReport,
  collectPackOccurrences
} from "./services/canonicalCoverage.js";
import { isPricesApiConfigured, resolveCanonicalIngredients } from "./services/pricesApi.js";

const MANIFEST_URL = "packs/manifest.json";
let lastReport = null;

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchJSON(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status}).`);
  return response.json();
}

async function buildBrowserCoverageInput() {
  const manifest = await fetchJSON(MANIFEST_URL);
  const entries = baseManifestEntries(manifest);
  const occurrences = [];
  for (const entry of entries) {
    const path = String(entry.path || "").replace(/^\.\//, "");
    if (!path.startsWith("packs/") || path.includes("..")) continue;
    const pack = await fetchJSON(path);
    occurrences.push(...collectPackOccurrences(pack, path));
  }
  return {
    basePacks: entries.length,
    ingredients: aggregateCoverageOccurrences(occurrences)
  };
}

async function resolveInChunks(ingredients) {
  const resolutions = [];
  for (let index = 0; index < ingredients.length; index += 100) {
    const chunk = ingredients.slice(index, index + 100);
    const result = await resolveCanonicalIngredients({ queries: chunk.map(item => item.name) });
    if (result.length !== chunk.length) throw new Error("La respuesta del resolver no coincide con el lote enviado.");
    resolutions.push(...result);
  }
  return resolutions;
}

function pct(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function statusLabel(status) {
  return {
    unresolved: "Sin canonical",
    ambiguous: "Ambiguo",
    suggested_alias: "Alias sugerido",
    verified_alias: "Alias verificado",
    canonical_exact: "Canonical exacto"
  }[status] || status;
}

function renderReport(container, input, report) {
  const summary = report.summary;
  const gaps = report.items.filter(item => !["canonical_exact", "verified_alias"].includes(item.status));
  container.innerHTML = `
    <div class="item success">
      <strong>Cobertura por usos reales: ${pct(summary.coverageOccurrences)}</strong>
      <p class="qty-line">${summary.resolvedOccurrences}/${summary.totalOccurrences} apariciones resueltas · ${summary.resolvedUnique}/${summary.uniqueIngredients} ingredientes únicos · ${input.basePacks} packs base.</p>
    </div>
    <div class="item">
      <strong>Huecos prioritarios</strong>
      <p class="small muted">Ordenados primero por fiabilidad pendiente y después por frecuencia. Exactos y aliases verificados sí cuentan como cobertura; sugerencias no.</p>
      ${gaps.length ? `<div class="list">${gaps.slice(0, 50).map(item => {
        const candidate = item.canonicalName ? ` → ${escapeText(item.canonicalName)} (${escapeText(item.canonicalId)})` : "";
        return `<div class="item"><strong>${escapeText(item.name)}</strong><span class="badge">${escapeText(statusLabel(item.status))}</span><p class="qty-line">${item.count} uso(s)${candidate}</p></div>`;
      }).join("")}</div>` : `<p class="muted">Todos los ingredientes están resueltos de forma fiable.</p>`}
    </div>
    <div class="actions wrap">
      <button type="button" class="secondary" data-action="download-canonical-coverage">Descargar informe JSON</button>
    </div>
  `;
}

async function runAudit(container) {
  if (!isPricesApiConfigured()) throw new Error("Prices API no está configurada en esta instalación.");
  container.innerHTML = `<p class="muted">Leyendo packs y resolviendo ingredientes...</p>`;
  const input = await buildBrowserCoverageInput();
  const resolutions = await resolveInChunks(input.ingredients);
  lastReport = {
    generatedAt: new Date().toISOString(),
    generatedFrom: "Gestor-Alimentacion/packs/manifest.json",
    basePacks: input.basePacks,
    ...buildCoverageReport(input.ingredients, resolutions)
  };
  renderReport(container, input, lastReport);
  showAlert(`Auditoría canonical completada: ${pct(lastReport.summary.coverageOccurrences)} de usos resueltos.`);
}

function ensureAuditCard() {
  const remoteList = document.getElementById("remotePackList");
  if (!remoteList || document.querySelector("[data-canonical-coverage-card]")) return;
  const packsCard = remoteList.closest(".packs-card, .card");
  if (!packsCard) return;
  const card = document.createElement("article");
  card.className = "card packs-card";
  card.dataset.canonicalCoverageCard = "true";
  card.innerHTML = `
    <h2>Cobertura del catálogo canonical</h2>
    <p class="muted">Audita los ingredientes usados por los packs base contra Prices API. No modifica datos ni verifica aliases automáticamente.</p>
    <div class="actions wrap"><button type="button" data-action="audit-canonical-coverage">Auditar catálogo canonical</button></div>
    <div data-canonical-coverage-results style="margin-top:1rem"></div>
  `;
  packsCard.insertAdjacentElement("afterend", card);
}

function downloadReport() {
  if (!lastReport) return;
  const blob = new Blob([`${JSON.stringify(lastReport, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "canonical-coverage-report.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "download-canonical-coverage") {
    downloadReport();
    return;
  }
  if (button.dataset.action !== "audit-canonical-coverage") return;
  const container = button.closest("[data-canonical-coverage-card]")?.querySelector("[data-canonical-coverage-results]");
  if (!container) return;
  button.disabled = true;
  runAudit(container).catch(error => {
    console.error(error);
    container.innerHTML = `<p class="alert error">${escapeText(error.message || "No se pudo auditar el catálogo canonical.")}</p>`;
    showAlert(error.message || "No se pudo auditar el catálogo canonical.", "error");
  }).finally(() => { button.disabled = false; });
});

if (typeof MutationObserver !== "undefined") {
  ensureAuditCard();
  const viewRoot = document.getElementById("viewRoot");
  if (viewRoot) new MutationObserver(ensureAuditCard).observe(viewRoot, { childList: true, subtree: true });
}
