import { getState, updateState } from "./store.js";
import { readFileAsText, safeJsonParse } from "./utils.js";
import { showAlert, openModal, closeModal, formToObject, getSubmitterValue } from "./render/ui.js";
import { renderPackPreview } from "./render/packs.js";
import { listRemotePacks, loadRemotePack, mergePackIntoState, normalizePack, buildPackPrompt } from "./services/packLoader.js";
import { validatePack } from "./validation.js";

let remotePackFiles = [];
let pendingPackPreview = null;

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function root() {
  return document.getElementById("remotePackList");
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  try {
    if (action === "list-remote-packs") {
      stop(event);
      await listPacksIntoUi();
    }

    if (action === "install-remote-pack" || action === "preview-remote-pack") {
      stop(event);
      await previewRemotePack(button.dataset.index);
    }

    if (action === "select-all-pack-dishes") {
      stop(event);
      document.querySelectorAll('form[data-form="install-pack"] input[name="dishIds"]').forEach(input => { input.checked = true; });
      showAlert("Todas las recetas del pack están seleccionadas.");
    }

    if (action === "clear-pack-dishes") {
      stop(event);
      document.querySelectorAll('form[data-form="install-pack"] input[name="dishIds"]').forEach(input => { input.checked = false; });
      showAlert("Recetas desmarcadas. Marca las que quieras importar.");
    }

    if (action === "copy-pack-prompt") {
      stop(event);
      await copyPackPrompt();
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo completar la acción de packs.", "error");
  }
}, true);

document.addEventListener("change", async event => {
  if (event.target.id !== "packFile") return;
  try {
    stop(event);
    await importLocalPackPreview(event.target.files?.[0]);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo leer el pack local.", "error");
  } finally {
    event.target.value = "";
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest("form");
  if (!form) return;

  try {
    if (form.dataset.form === "install-pack") {
      stop(event);
      installPreviewedPack(form, event);
    }

    if (form.dataset.form === "pack-prompt") {
      stop(event);
      generatePackPrompt(form);
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo procesar el pack.", "error");
  }
}, true);

async function listPacksIntoUi() {
  const container = root();
  if (!container) return;
  container.innerHTML = `<p class="muted">Buscando packs...</p>`;
  remotePackFiles = await listRemotePacks();
  container.innerHTML = remotePackFiles.length
    ? remotePackFiles.map((file, index) => `
      <div class="item">
        <strong>${escapeText(file.name)}</strong>
        <p class="qty-line">${escapeText(file.path)}</p>
        <button data-action="preview-remote-pack" data-index="${index}">Previsualizar</button>
      </div>`).join("")
    : `<p class="muted">No se encontraron packs.</p>`;
}

async function previewRemotePack(index) {
  const file = remotePackFiles[Number(index)];
  if (!file) throw new Error("Pack no encontrado.");
  const pack = await loadRemotePack(file);
  pendingPackPreview = pack;
  openModal(renderPackPreview(pack, index));
  showAlert(`Pack cargado: ${pack.dishes.length} receta(s) disponibles.`);
}

async function importLocalPackPreview(file) {
  if (!file) return;
  const text = await readFileAsText(file);
  const pack = normalizePack(safeJsonParse(text));
  validatePack(pack);
  pendingPackPreview = pack;
  openModal(renderPackPreview(pack, "local"));
  showAlert(`Pack local cargado: ${pack.dishes.length} receta(s) disponibles.`);
}

function installPreviewedPack(form, event) {
  if (!pendingPackPreview) throw new Error("No hay pack cargado para instalar.");
  const mode = getSubmitterValue(event, "installMode") || "all";
  const selectedDishIds = mode === "all"
    ? pendingPackPreview.dishes.map(dish => dish.id)
    : Array.from(form.querySelectorAll('input[name="dishIds"]:checked')).map(input => input.value);
  if (!selectedDishIds.length) throw new Error("Selecciona al menos una receta para instalar.");

  updateState(draft => mergePackIntoState(draft, pendingPackPreview, { selectedDishIds }), "pack-install-selected");
  const installedName = pendingPackPreview.name;
  const total = selectedDishIds.length;
  pendingPackPreview = null;
  closeModal();
  showAlert(`Pack ${installedName} instalado con ${total} receta(s).`);
}

function generatePackPrompt(form) {
  const output = document.getElementById("packPromptOutput");
  if (!output) return;
  output.value = buildPackPrompt(formToObject(form));
  showAlert("Prompt generado. Puedes copiarlo y usarlo con una IA.");
}

async function copyPackPrompt() {
  const output = document.getElementById("packPromptOutput");
  if (!output?.value) throw new Error("Primero genera un prompt.");
  await navigator.clipboard.writeText(output.value);
  showAlert("Prompt copiado al portapapeles.");
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.__gestorPackDebug = { getState };
