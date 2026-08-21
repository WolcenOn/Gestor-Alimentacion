import { getState, updateState } from "./store.js";
import { readFileAsText, safeJsonParse } from "./utils.js";
import { showAlert, openModal, closeModal, formToObject, getSubmitterValue } from "./render/ui.js";
import { renderPackPreview, renderPackDeleteConfirmation } from "./render/packs.js";
import { listRemotePacks, loadRemotePack, mergePackIntoState, normalizePack, buildPackPrompt } from "./services/packLoader.js";
import { collectCanonicalPackRequirements } from "./services/packPricing.js";
import { getPricesPostalCode, isPricesApiConfigured, quoteCanonicalIngredient } from "./services/pricesApi.js";
import { validatePack } from "./validation.js";

let remotePackFiles = [];
let pendingPackPreview = null;
let listingRemotePacks = false;

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function root() {
  return document.getElementById("remotePackList");
}

function packInstallSelector() {
  return 'form[data-form="pack-install"], form[data-form="install-pack"]';
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
      document.querySelectorAll(`${packInstallSelector()} input[name="dishIds"]`).forEach(input => { input.checked = true; });
      showAlert("Todas las recetas del pack están seleccionadas.");
    }

    if (action === "clear-pack-dishes") {
      stop(event);
      document.querySelectorAll(`${packInstallSelector()} input[name="dishIds"]`).forEach(input => { input.checked = false; });
      showAlert("Recetas desmarcadas. Marca las que quieras importar.");
    }

    if (action === "copy-pack-prompt") {
      stop(event);
      await copyPackPrompt();
    }

    if (action === "confirm-delete-pack") {
      stop(event);
      openDeletePackModal(button.dataset.packId || "");
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
    pendingPackPreview = null;
    showAlert(error.message || "No se pudo leer el pack local.", "error");
  } finally {
    event.target.value = "";
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest("form");
  if (!form) return;

  try {
    if (form.dataset.form === "pack-install" || form.dataset.form === "install-pack") {
      stop(event);
      installPreviewedPack(form, event);
    }

    if (form.dataset.form === "pack-prompt") {
      stop(event);
      generatePackPrompt(form);
    }

    if (form.dataset.form === "delete-installed-pack") {
      stop(event);
      deleteInstalledPack(form);
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo procesar el pack.", "error");
  }
}, true);

async function listPacksIntoUi() {
  const container = root();
  if (!container) {
    showAlert("Abre la sección Packs para cargar los packs remotos.", "error");
    return;
  }
  if (listingRemotePacks) return;
  listingRemotePacks = true;
  pendingPackPreview = null;
  remotePackFiles = [];
  closeModal();
  container.innerHTML = `<p class="muted">Buscando packs remotos...</p>`;
  try {
    remotePackFiles = await listRemotePacks();
    container.innerHTML = remotePackFiles.length
      ? remotePackFiles.map((file, index) => {
        const searchText = [file.name, file.path, String(file.path || "").replaceAll("/", " ").replaceAll("-", " ")].join(" ");
        return `
        <div class="item pack-file-item" data-search="${escapeText(searchText)}">
          <strong>${escapeText(file.name)}</strong>
          <p class="qty-line">${escapeText(file.path)}</p>
          <button data-action="preview-remote-pack" data-index="${index}">Previsualizar</button>
        </div>`;
      }).join("")
      : `<p class="muted">No se encontraron packs remotos.</p>`;
    showAlert(`${remotePackFiles.length} pack(s) remoto(s) encontrados.`);
  } catch (error) {
    console.error(error);
    container.innerHTML = `<p class="alert error">${escapeText(error.message || "No se pudieron cargar los packs remotos.")}</p>`;
    throw error;
  } finally {
    listingRemotePacks = false;
  }
}

async function previewRemotePack(index) {
  const file = remotePackFiles[Number(index)];
  if (!file) throw new Error("Pack no encontrado. Vuelve a buscar packs remotos.");
  const pack = await loadRemotePack(file);
  pendingPackPreview = pack;
  openModal(renderPackPreview(pack, index));
  void hydratePackPriceQuotes(pack);
  showAlert(`Pack cargado: ${pack.dishes.length} receta(s) disponibles.`);
}

async function importLocalPackPreview(file) {
  if (!file) return;
  const text = await readFileAsText(file);
  const pack = normalizePack(safeJsonParse(text));
  validatePack(pack);
  remotePackFiles = [];
  pendingPackPreview = pack;
  openModal(renderPackPreview(pack, "local"));
  void hydratePackPriceQuotes(pack);
  showAlert(`Pack local cargado: ${pack.dishes.length} receta(s) disponibles.`);
}

async function hydratePackPriceQuotes(pack) {
  const form = document.querySelector(packInstallSelector());
  if (!form) return;
  const requirements = collectCanonicalPackRequirements(pack);
  if (!requirements.length) return;

  const card = document.createElement("section");
  card.className = "item pack-price-preview";
  const title = document.createElement("strong");
  title.textContent = "Precio de compra automático";
  const description = document.createElement("p");
  description.className = "qty-line";
  description.textContent = `Cotización del pack completo · CP ${getPricesPostalCode()}. No modifica tus precios guardados.`;
  const list = document.createElement("div");
  list.className = "list";
  card.append(title, description, list);

  const successCard = form.querySelector(".item.success");
  if (successCard) successCard.insertAdjacentElement("afterend", card);
  else form.prepend(card);

  const rows = requirements.map(requirement => {
    const row = document.createElement("div");
    row.className = "item pack-price-row";
    const label = document.createElement("strong");
    label.textContent = `${requirement.canonicalIngredientName}: ${formatQuantity(requirement.amount)} ${requirement.unit}`;
    const result = document.createElement("p");
    result.className = "qty-line";
    result.textContent = isPricesApiConfigured() ? "Consultando precio..." : "Prices API no configurada.";
    row.append(label, result);
    list.append(row);
    return { requirement, result };
  });

  if (!isPricesApiConfigured()) {
    const note = document.createElement("p");
    note.className = "small muted";
    note.textContent = "Configura PRICES_API_BASE_URL para activar la cotización automática.";
    card.append(note);
    return;
  }

  await Promise.all(rows.map(async ({ requirement, result }) => {
    try {
      const payload = await quoteCanonicalIngredient({
        ingredientId: requirement.canonicalIngredientId,
        amount: requirement.amount,
        unit: requirement.unit
      });
      const quote = Array.isArray(payload?.items) ? payload.items[0] : null;
      if (!quote) {
        result.textContent = "Sin producto compatible con precio disponible.";
        return;
      }
      result.textContent = formatPurchaseQuote(quote);
    } catch (error) {
      console.warn("No se pudo cotizar ingrediente canónico", requirement.canonicalIngredientId, error);
      result.textContent = `No se pudo cargar el precio: ${error.message || "error de conexión"}`;
    }
  }));
}

function formatPurchaseQuote(quote) {
  const product = quote?.product || {};
  const supermarket = String(product.supermarketId || "supermercado").toUpperCase();
  const productName = String(product.name || "Producto");
  const totalCost = Number(quote?.totalCost);
  const costLabel = Number.isFinite(totalCost)
    ? totalCost.toLocaleString("es-ES", { style: "currency", currency: "EUR" })
    : "precio no disponible";
  const packageCount = Number(quote?.packageCount || 0);
  const purchaseLabel = packageCount > 0
    ? `${packageCount} paquete(s)`
    : `${formatQuantity(quote?.purchasedAmount)} ${String(quote?.purchasedUnit || "")}`.trim();
  return `${supermarket} · ${productName} · ${purchaseLabel} · ${costLabel}`;
}

function formatQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("es-ES", { maximumFractionDigits: 3 }) : String(value || "");
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

function openDeletePackModal(packId) {
  if (!packId) throw new Error("Pack no encontrado.");
  openModal(renderPackDeleteConfirmation(getState(), packId));
}

function deleteInstalledPack(form) {
  const packId = form.dataset.packId || "";
  const removePlanning = Boolean(form.elements.removePlanning?.checked);
  let deletedRecipes = 0;
  let removedPlanning = 0;
  let packName = "pack";

  updateState(draft => {
    draft.dishPacks ||= [];
    draft.dishes ||= [];
    draft.weeks ||= [];
    const pack = draft.dishPacks.find(item => item.id === packId);
    if (!pack) throw new Error("Pack no encontrado.");
    packName = pack.name;
    const dishIds = new Set(draft.dishes.filter(dish => dish.packId === packId).map(dish => dish.id));
    deletedRecipes = dishIds.size;

    if (removePlanning) {
      for (const week of draft.weeks || []) {
        for (const [slot, planned] of Object.entries(week.plan || {})) {
          const next = (planned || []).filter(dishId => {
            const remove = dishIds.has(dishId);
            if (remove) removedPlanning += 1;
            return !remove;
          });
          if (next.length) week.plan[slot] = next;
          else delete week.plan[slot];
        }
      }
    }

    draft.dishes = draft.dishes.filter(dish => dish.packId !== packId);
    draft.dishPacks = draft.dishPacks.filter(item => item.id !== packId);
  }, removePlanning ? "pack-delete-with-planning" : "pack-delete-recipes-only");

  closeModal();
  showAlert(`${packName} eliminado: ${deletedRecipes} receta(s) quitadas${removePlanning ? ` y ${removedPlanning} referencia(s) de planificación borradas` : ""}.`);
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

window.__gestorPackDebug = { getState, listPacksIntoUi, hydratePackPriceQuotes };
