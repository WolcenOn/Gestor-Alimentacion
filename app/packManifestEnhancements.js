import { updateState } from "./store.js";
import { showAlert, openModal, closeModal, getSubmitterValue } from "./render/ui.js";
import { renderPackPreview } from "./render/packs.js";
import { mergePackIntoState, normalizePack } from "./services/packLoader.js";
import { mergeCanonicalPackIntoState, normalizeCanonicalReadyPack } from "./services/canonicalPackBridge.js";
import { validatePack } from "./validation.js";

const CATALOG_BRANCH = "main";
const CATALOG_BASE_URL = `https://raw.githubusercontent.com/WolcenOn/Gestor-Alimentacion/${CATALOG_BRANCH}`;
const MANIFEST_URL = `${CATALOG_BASE_URL}/packs/manifest.json`;
let manifestPackFiles = [];
let manifestPackPreview = null;
let manifestPackPreviewCanonicalReady = false;

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadManifest() {
  const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`No se pudo cargar el catálogo de packs (${response.status}).`);
  const manifest = await response.json();
  if (!Array.isArray(manifest)) throw new Error("El catálogo de packs no tiene el formato esperado.");
  return manifest.map(entry => {
    const path = String(entry.path || "").replace(/^\.\//, "");
    if (!path.startsWith("packs/") || !path.endsWith(".json") || path.includes("..")) {
      throw new Error(`Ruta de pack no permitida: ${path}`);
    }
    return {
      name: entry.title || entry.name || path.split("/").pop(),
      path,
      description: entry.description || "",
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      canonicalReady: Boolean(entry.canonicalReady) || path.startsWith("packs/canonical/"),
      downloadUrl: `${CATALOG_BASE_URL}/${path}?v=${Date.now()}`
    };
  }).sort((a, b) => Number(b.canonicalReady) - Number(a.canonicalReady) || a.name.localeCompare(b.name, "es"));
}

async function listPacksFromManifest() {
  const container = document.getElementById("remotePackList");
  if (!container) return;
  manifestPackPreview = null;
  manifestPackPreviewCanonicalReady = false;
  manifestPackFiles = [];
  closeModal();
  container.innerHTML = `<p class="muted">Buscando packs...</p>`;
  manifestPackFiles = await loadManifest();
  const canonicalCount = manifestPackFiles.filter(file => file.canonicalReady).length;
  container.innerHTML = manifestPackFiles.length
    ? manifestPackFiles.map((file, index) => {
      const searchText = [file.name, file.path, file.description, file.tags.join(" "), file.canonicalReady ? "canonical prices api" : ""].join(" ");
      return `
        <div class="item pack-file-item" data-search="${escapeText(searchText)}">
          <div class="item-title">
            <strong>${escapeText(file.name)}</strong>
            ${file.canonicalReady ? `<span class="badge success">Canonical · Prices API</span>` : ""}
          </div>
          <p class="qty-line">${escapeText(file.description || file.path)}</p>
          ${file.canonicalReady ? `<p class="small muted">Versión preparada para enlazar ingredientes canónicos y consultar Prices API.</p>` : ""}
          <button data-action="preview-manifest-pack" data-index="${index}">Previsualizar</button>
        </div>`;
    }).join("")
    : `<p class="muted">No hay packs publicados todavía.</p>`;
  showAlert(`${manifestPackFiles.length} pack(s) disponibles · ${canonicalCount} canonical-ready · catálogo ${CATALOG_BRANCH}.`);
}

async function previewManifestPack(index) {
  const file = manifestPackFiles[Number(index)];
  if (!file) throw new Error("Pack no encontrado. Vuelve a buscar packs remotos.");
  const response = await fetch(file.downloadUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`No se pudo descargar el pack (${response.status}).`);
  const text = await response.text();
  if (/javascript:|<\s*script/gi.test(text)) throw new Error("Pack potencialmente inseguro.");
  const parsed = JSON.parse(text);
  const pack = file.canonicalReady ? normalizeCanonicalReadyPack(parsed) : normalizePack(parsed);
  validatePack(pack);
  manifestPackPreview = pack;
  manifestPackPreviewCanonicalReady = file.canonicalReady;
  openModal(renderPackPreview(pack, `manifest-${index}`));
  showAlert(`Pack cargado: ${pack.dishes.length} receta(s) disponibles${file.canonicalReady ? " · canonical-ready" : ""}.`);
}

function installManifestPack(form, event) {
  if (!manifestPackPreview) return false;
  const mode = getSubmitterValue(event, "installMode") || "all";
  const selectedDishIds = mode === "all"
    ? manifestPackPreview.dishes.map(dish => dish.id)
    : Array.from(form.querySelectorAll('input[name="dishIds"]:checked')).map(input => input.value);
  if (!selectedDishIds.length) throw new Error("Selecciona al menos una receta para instalar.");
  updateState(draft => {
    if (manifestPackPreviewCanonicalReady) {
      mergeCanonicalPackIntoState(draft, manifestPackPreview, { selectedDishIds });
    } else {
      mergePackIntoState(draft, manifestPackPreview, { selectedDishIds });
    }
  }, "pack-install-manifest");
  const installedName = manifestPackPreview.name;
  const total = selectedDishIds.length;
  manifestPackPreview = null;
  manifestPackPreviewCanonicalReady = false;
  closeModal();
  showAlert(`Pack ${installedName} instalado con ${total} receta(s).`);
  return true;
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action !== "list-remote-packs" && action !== "preview-manifest-pack") return;
  stop(event);
  const run = action === "list-remote-packs"
    ? listPacksFromManifest()
    : previewManifestPack(button.dataset.index);
  run.catch(error => {
    console.error(error);
    const container = document.getElementById("remotePackList");
    if (container) container.innerHTML = `<p class="alert error">${escapeText(error.message || "No se pudieron cargar los packs.")}</p>`;
    showAlert(error.message || "No se pudieron cargar los packs.", "error");
  });
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="pack-install"], form[data-form="install-pack"]');
  if (!form || !manifestPackPreview) return;
  try {
    stop(event);
    installManifestPack(form, event);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo instalar el pack.", "error");
  }
}, true);

window.__gestorPackManifest = { listPacksFromManifest };
