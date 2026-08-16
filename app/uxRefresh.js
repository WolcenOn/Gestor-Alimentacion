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
  const assistantCard = cards.find(card => Boolean(card.querySelector('[data-action="open-week-planner-assistant"]')));
  if (assistantCard) {
    setText(assistantCard.querySelector("h3"), "Crear semana automáticamente");
    setText(assistantCard.querySelector(".muted"), "Completa huecos con tus platos y preferencias sin editar cada casilla.");
    setText(assistantCard.querySelector("button"), "Crear propuesta");
  }

  if (cards.length > DASHBOARD_PRIMARY_COUNT && once(launcher, "uxGrouped")) {
    const details = document.createElement("details");
    details.className = "ux-dashboard-more";
    details.innerHTML = '<summary>Más acciones</summary><div class="ux-dashboard-more-content"></div>';
    const content = details.querySelector(".ux-dashboard-more-content");
    cards.slice(DASHBOARD_PRIMARY_COUNT).forEach(card => content.append(card));
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

  const primaryActions = new Set(["open-week-planner-assistant", "open-current-week", "new-week"]);
  const secondaryButtons = [...actions.querySelectorAll("button")].filter(button => !primaryActions.has(button.dataset.action));
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
  monthCard.querySelectorAll(".calendar-month-head, .calendar-month-days").forEach(node => node.remove());

  const grid = monthCard.querySelector(".calendar-month-grid");
  if (grid) {
    grid.classList.add("ux-month-week-list");
    grid.removeAttribute("role");
  }
  monthCard.querySelectorAll(".calendar-month-week").forEach(week => week.classList.add("ux-month-week-row"));
}

function cardByHeading(text) {
  return [...(viewRoot?.querySelectorAll(".settings-grid .card, #viewRoot > .card, #viewRoot article.card") || [])]
    .find(card => card.querySelector("h3")?.textContent.trim() === text);
}

function wrapSettingCard(card, title, description, open = false) {
  if (!card || card.closest(".ux-settings-disclosure")) return null;
  const details = document.createElement("details");
  details.className = "ux-settings-disclosure";
  if (open) details.open = true;
  details.innerHTML = `<summary><span><strong>${title}</strong><small>${description}</small></span><span class="ux-chevron" aria-hidden="true">⌄</span></summary><div class="ux-settings-disclosure-body"></div>`;
  card.before(details);
  details.querySelector(".ux-settings-disclosure-body").append(card);
  return details;
}

function enhanceSettings() {
  const header = viewRoot?.querySelector(".settings-header");
  if (!header || !once(header, "uxSimplified")) return;

  setText(header.querySelector("h2"), "Ajustes");
  setText(header.querySelector(".muted"), "Configura tu hogar, la rutina de comidas y cómo se guardan tus datos.");
  header.querySelector(".eyebrow")?.remove();

  const family = cardByHeading("Miembros de la familia");
  const meals = cardByHeading("Comidas registrables");
  if (family) {
    setText(family.querySelector("h3"), "Personas en casa");
    setText(family.querySelector(".muted"), "Añade a quienes participan en la planificación semanal.");
    family.classList.add("ux-settings-primary-card");
  }
  if (meals) {
    setText(meals.querySelector("h3"), "Comidas del día");
    setText(meals.querySelector(".muted"), "Elige las comidas que quieres planificar habitualmente.");
    meals.classList.add("ux-settings-primary-card");
  }

  const cloud = cardByHeading("Nube y sincronización");
  if (cloud) {
    setText(cloud.querySelector("h3"), "Cuenta y sincronización");
    setText(cloud.querySelector(".muted"), "Mantén tus datos disponibles entre dispositivos y miembros del hogar.");
    cloud.classList.add("ux-settings-cloud-card");

    const facts = cloud.querySelector(".mini-facts");
    if (facts) facts.classList.add("ux-settings-technical");
    cloud.querySelectorAll("code").forEach(code => code.closest("p")?.classList.add("ux-settings-technical"));
    [...cloud.querySelectorAll("p")].forEach(p => {
      if (/ID hogar sync|Última actualización en nube|Último intento|reintentos/i.test(p.textContent)) p.classList.add("ux-settings-technical");
    });
    [...cloud.querySelectorAll(".help-note")].forEach(note => note.classList.add("ux-settings-technical"));

    if (!cloud.querySelector(".ux-sync-advanced-toggle")) {
      const technical = [...cloud.querySelectorAll(".ux-settings-technical")];
      if (technical.length) {
        const details = document.createElement("details");
        details.className = "ux-sync-advanced-toggle";
        details.innerHTML = '<summary>Detalles técnicos de sincronización</summary><div class="ux-sync-advanced-body"></div>';
        const body = details.querySelector(".ux-sync-advanced-body");
        technical[0].before(details);
        technical.forEach(node => body.append(node));
      }
    }
  }

  const privacy = cardByHeading("Privacidad y datos");
  wrapSettingCard(privacy, "Datos y privacidad", "Copias, exportación y borrado local.");

  const usda = cardByHeading("USDA FoodData Central");
  wrapSettingCard(usda, "Fuentes nutricionales", "Configura fuentes externas solo si necesitas enriquecer datos nutricionales.");

  const batch = cardByHeading("Enriquecimiento nutricional por lotes");
  wrapSettingCard(batch, "Completar nutrición automáticamente", "Busca información nutricional para ingredientes pendientes.");

  const exportCard = cardByHeading("Exportar e importar datos");
  wrapSettingCard(exportCard, "Copias de seguridad", "Descarga o restaura una copia de tus datos.");

  const primaryGrid = family?.closest(".settings-grid");
  if (primaryGrid) primaryGrid.classList.add("ux-settings-primary-grid");

  const advancedHeadingExists = viewRoot.querySelector(".ux-settings-advanced-heading");
  const firstDisclosure = viewRoot.querySelector(".ux-settings-disclosure");
  if (!advancedHeadingExists && firstDisclosure) {
    const heading = document.createElement("div");
    heading.className = "ux-settings-advanced-heading";
    heading.innerHTML = '<h3>Datos y opciones avanzadas</h3><p class="muted">Estas opciones no suelen ser necesarias en el uso diario.</p>';
    firstDisclosure.before(heading);
  }
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
  enhanceSettings();
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
