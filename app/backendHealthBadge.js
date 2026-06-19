const HEALTH_BADGE_ID = "backendHealthBadge";
const DEFAULT_TIMEOUT_MS = 8000;

function configBaseUrl() {
  const config = window.APP_CONFIG || window.GESTOR_APP_CONFIG || {};
  return String(config.API_BASE_URL || config.apiBaseUrl || "").trim().replace(/\/+$/, "");
}

function backendOrigin() {
  return configBaseUrl().replace(/\/api\/v\d+$/i, "");
}

function labelFor(payload, error) {
  if (!backendOrigin()) return { text: "Cloud sin configurar", className: "warning", title: "Configura app/config.js para activar Railway." };
  if (error) return { text: "Backend no disponible", className: "warning", title: error.message || String(error) };
  if (payload?.database === "ok") return { text: "Backend OK", className: "", title: `Railway conectado · DB ${payload.database}` };
  return { text: "Backend parcial", className: "warning", title: `Estado DB: ${payload?.database || "desconocido"}` };
}

function ensureBadge() {
  let badge = document.getElementById(HEALTH_BADGE_ID);
  if (badge) return badge;

  const host = document.querySelector(".header-actions");
  if (!host) return null;

  badge = document.createElement("button");
  badge.id = HEALTH_BADGE_ID;
  badge.type = "button";
  badge.className = "secondary";
  badge.textContent = "Comprobar backend";
  badge.title = "Ejecuta GET /health en el backend Railway configurado.";
  badge.addEventListener("click", () => checkBackendHealth({ showDetails: true }));
  host.prepend(badge);
  return badge;
}

async function fetchHealth() {
  const origin = backendOrigin();
  if (!origin) throw new Error("Backend cloud no configurado.");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}/health`, { signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Healthcheck HTTP ${response.status}`);
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function checkBackendHealth({ showDetails = false } = {}) {
  const badge = ensureBadge();
  if (!badge) return;

  badge.textContent = "Comprobando backend…";
  badge.classList.remove("warning");

  try {
    const payload = await fetchHealth();
    const status = labelFor(payload, null);
    badge.textContent = status.text;
    badge.title = status.title;
    if (status.className) badge.classList.add(status.className);
    if (showDetails) {
      alert(`Healthcheck Railway:\n${JSON.stringify(payload, null, 2)}`);
    }
  } catch (error) {
    const status = labelFor(null, error);
    badge.textContent = status.text;
    badge.title = status.title;
    badge.classList.add("warning");
    if (showDetails) alert(status.title);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  ensureBadge();
  checkBackendHealth().catch(() => {});
});
