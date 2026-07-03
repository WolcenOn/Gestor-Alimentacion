import { updateState } from "./store.js";
import { showAlert, openModal, closeModal, getSubmitterValue } from "./render/ui.js";
import { renderPackPreview } from "./render/packs.js";
import { mergePackIntoState, normalizePack } from "./services/packLoader.js";
import { validatePack } from "./validation.js";

const MANIFEST_URL = "packs/manifest.json";
let manifestPackFiles = [];
let manifestPackPreview = null;

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
  if (!response.ok) throw new Error(`No se pudo cargar el índice local de packs (${response.status}).`);
  const manifest = await response.json();
  if (!Array.isArray(manifest)) throw new Error("El índice local de packs no tiene el formato esperado.");
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
      downloadUrl: `${path}?v=${Date.now()}`
    };
  });
}

async function listPacksFromManifest() {
  const container = document.getElementById("remotePackList");
  if (!container) return;
  manifestPackPreview = null;
  manifestPackFiles = [];
  closeModal();
  container.innerHTML = `<p class="muted">Buscando packs...</p>`;
  manifestPackFiles = await loadManifest();
  container.innerHTML = manifestPackFiles.length
    ? manifestPackFiles.map((file, index) => {
      const searchText = [file.name, file.path, file.description, file.tags.join(" ")].join(" ");
      return `
        <div class="item pack-file-item" data-search="${escapeText(searchText)}">
          <strong>${escapeText(file.name)}</strong>
          <p class="qty-line">${escapeText(file.description || file.path)}</p>
          <button data-action="preview-manifest-pack" data-index="${index}">Previsualizar</button>
        </div>`;
    }).join("")
    : `<p class="muted">No hay packs publicados todavía.</p>`;
  showAlert(`${manifestPackFiles.length} pack(s) remoto(s) disponibles.`);
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
  const pack = normalizePack(JSON.parse(text));
  validatePack(pack);
  manifestPackPreview = pack;
  openModal(renderPackPreview(pack, `manifest-${index}`));
  showAlert(`Pack cargado: ${pack.dishes.length} receta(s) disponibles.`);
}

function installManifestPack(form, event) {
  if (!manifestPackPreview) return false;
  const mode = getSubmitterValue(event, "installMode") || "all";
  const selectedDishIds = mode === "all"
    ? manifestPackPreview.dishes.map(dish => dish.id)
    : Array.from(form.querySelectorAll('input[name="dishIds"]:checked')).map(input => input.value);
  if (!selectedDishIds.length) throw new Error("Selecciona al menos una receta para instalar.");
  updateState(draft => mergePackIntoState(draft, manifestPackPreview, { selectedDishIds }), "pack-install-manifest");
  const installedName = manifestPackPreview.name;
  const total = selectedDishIds.length;
  manifestPackPreview = null;
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
