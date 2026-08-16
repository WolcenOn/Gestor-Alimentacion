const viewRoot = document.getElementById("viewRoot");
const syncBadge = document.getElementById("uxSyncStatus");

const DASHBOARD_PRIMARY_COUNT = 4;
let enhancementScheduled = false;
let assistantReplay = false;
let assistantImportPromise = null;

function once(node, key) {
  if (!node || node.dataset[key]) return false;
  node.dataset[key] = "true";
  return true;
}

function setText(node, value) {
  if (!node || node.textContent === value) return;
  node.textContent = value;
}

function enhanceDashboard() {
  const header = viewRoot?.querySelector(".dashboard-header-clean");
  const launcher = viewRoot?.querySelector(".task-launcher");
  const metrics = viewRoot?.querySelector(".dashboard-metric-grid");
  if (!header || !launcher) return;

  header.querySelector("h2")?.setAttribute("data-ux-week-title", "true");
  setText(header.querySelector(".muted"), "Lo importante de hoy y los siguientes pasos para tener la semana bajo control.");

  launcher.classList.add("ux-primary-actions");
  const cards = [...launcher.querySelectorAll(":scope > .task-card")];
  const assistantCard = cards.find(card => {
    const action = card.querySelector('[data-action="open-week-planner-assistant"]');
    return Boolean(action);
  });
  if (assistantCard) {
    setText(assistantCard.querySelector("h3"), "Crear semana automáticamente");
    setText(assistantCard.querySelector(".muted"), "Completa huecos con tus platos y preferencias sin editar cada casilla.");
    setText(assistantCard.querySelector("button"), "Crear propuesta");
  }

  if (cards.length > DASHBOARD_PRIMARY_COUNT && once(launcher, "uxGrouped")) {
    const extra = cards.slice(DASHBOARD_PRIMARY_COUNT);
    const details = document.createElement("details");
    details.className = "ux-dashboard-more";
    details.innerHTML = '<summary>Más acciones</summary><div class="ux-dashboard-more-content"></div>';
    const content = details.querySelector(".ux-dashboard-more-content");
    extra.forEach(card => content.append(card));
    launcher.after(details);
  }

  if (metrics && !metrics.closest(".ux-metrics-disclosure")) {
    const details = document.createElement("details");
    details.className = "ux-metrics-disclosure";
    details.innerHTML = '<summary>Ver resumen, stock y métricas</summary><div class="ux-metrics-content"></div>';
    metrics.before(details);
    details.querySelector(".ux-metrics-content").append(metrics);
  }
}

function enhanceCalendar() {
  const toolbar = viewRoot?.querySelector(".calendar-week-toolbar");
  if (!toolbar || !once(toolbar, "uxSimplified")) return;

  const actions = toolbar.querySelector(".toolbar-actions");
  if (!actions) return;

  const primaryActions = new Set([
    "open-week-planner-assistant",
    "open-current-week",
    "new-week"
  ]);
  const secondaryButtons = [...actions.querySelectorAll("button")].filter(button => {
    return !primaryActions.has(button.dataset.action);
  });

  setText(actions.querySelector('[data-action="open-week-planner-assistant"]'), "Autocompletar semana");
  setText(actions.querySelector('[data-action="new-week"]'), "Nueva semana");

  if (!secondaryButtons.length) return;
  const details = document.createElement("details");
  details.className = "ux-calendar-more";
  details.innerHTML = '<summary>Más opciones de semana</summary><div class="ux-calendar-more-content"><div class="actions"></div></div>';
  const moreActions = details.querySelector(".actions");
  secondaryButtons.forEach(button => moreActions.append(button));
  toolbar.after(details);
}

function enhanceMonthView() {
  const monthCard = viewRoot?.querySelector(".calendar-month-card");
  if (!monthCard || !once(monthCard, "uxSimplified")) return;

  const topbar = viewRoot.querySelector(".calendar-topbar");
  if (topbar) {
    setText(topbar.querySelector(".muted"), "Elige una semana para abrirla o crearla.");
    topbar.querySelector('[data-action="open-current-week"]')?.remove();
  }

  const titleRow = monthCard.querySelector(".section-title-row");
  titleRow?.querySelector(".muted")?.remove();
  titleRow?.querySelector('[data-action="open-current-week"]')?.remove();

  monthCard.querySelectorAll(".calendar-month-head").forEach(node => node.remove());
  monthCard.querySelectorAll(".calendar-month-days").forEach(node => node.remove());

  const grid = monthCard.querySelector(".calendar-month-grid");
  if (grid) {
    grid.classList.add("ux-month-week-list");
    grid.removeAttribute("role");
  }

  monthCard.querySelectorAll(".calendar-month-week").forEach(week => {
    week.classList.add("ux-month-week-row");
  });
}

function enhanceAssistant() {
  const modal = document.getElementById("modalRoot");
  const form = modal?.querySelector('form[data-form="week-planner-assistant"]');
  if (!form || !once(form, "uxSimplified")) return;

  setText(modal.querySelector("h2"), "Crear una propuesta para la semana");
  setText(modal.querySelector("header .muted"), "Elige días y comidas, selecciona platos y aplica la propuesta. Puedes ajustar el resultado después desde Semana.");

  const sections = [...form.querySelectorAll(":scope > .planner-section")];
  const titles = [
    "1. ¿Qué días quieres completar?",
    "2. ¿Para qué comida y personas?",
    "3. Busca o excluye platos",
    "4. Elige platos",
    "5. Revisa la combinación",
    "6. Propuestas listas para usar"
  ];
  sections.forEach((section, index) => {
    if (titles[index]) setText(section.querySelector("h3"), titles[index]);
  });

  setText(form.querySelector('[data-action="fill-planner-meal"]'), "Aplicar a la semana");
  setText(form.querySelector('[data-action="save-planner-combo"]'), "Guardar esta propuesta");
}

function enhanceCurrentView() {
  enhanceDashboard();
  enhanceCalendar();
  enhanceMonthView();
  enhanceAssistant();
}

function scheduleEnhancement() {
  if (enhancementScheduled) return;
  enhancementScheduled = true;
  window.requestAnimationFrame(() => {
    enhancementScheduled = false;
    enhanceCurrentView();
  });
}

function syncLabel(status = {}) {
  const mode = status.mode || "local";
  if (mode === "synced") return "Sincronizado";
  if (mode === "ready") return "Nube lista";
  if (mode === "syncing") return "Sincronizando…";
  if (mode === "pending") return "Cambios pendientes";
  if (mode === "error") return "Error de sincronización";
  return "Solo en este dispositivo";
}

function updateSyncBadge(status) {
  if (!syncBadge) return;
  const safeStatus = status || window.GestorCloudSync?.getStatus?.() || { mode: "local" };
  const mode = safeStatus.mode || "local";
  if (syncBadge.dataset.mode !== mode) syncBadge.dataset.mode = mode;
  setText(syncBadge, syncLabel(safeStatus));
  if (safeStatus.lastError) syncBadge.title = safeStatus.lastError;
  else syncBadge.removeAttribute("title");
}

async function ensureAssistantAndReplay(button) {
  try {
    assistantImportPromise ||= import("./weekPlannerAssistant.js?v=20260816-ux3");
    await assistantImportPromise;
    assistantReplay = true;
    button.click();
  } catch (error) {
    console.error("No se pudo cargar el asistente semanal", error);
    const alerts = document.getElementById("alerts");
    if (alerts) {
      const box = document.createElement("div");
      box.className = "alert error";
      box.textContent = "No se pudo abrir el asistente semanal. Recarga la aplicación e inténtalo de nuevo.";
      alerts.prepend(box);
      window.setTimeout(() => box.remove(), 7000);
    }
  } finally {
    assistantReplay = false;
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="open-week-planner-assistant"]');
  if (!button || assistantReplay) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ensureAssistantAndReplay(button);
}, true);

const observer = new MutationObserver(scheduleEnhancement);
if (viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
const modalRoot = document.getElementById("modalRoot");
if (modalRoot) observer.observe(modalRoot, { childList: true, subtree: true });

window.addEventListener("gestor:cloud-sync-status", event => updateSyncBadge(event.detail));
window.addEventListener("load", () => {
  scheduleEnhancement();
  updateSyncBadge();
  window.setTimeout(() => updateSyncBadge(), 900);
});

enhanceCurrentView();
updateSyncBadge();
