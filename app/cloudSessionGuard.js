const LOCAL_MODE_KEY = "gestorMenuSemanal.cloudLocalMode.v1";
const SESSION_PROMPT_ID = "cloudSessionPrompt";
const CHECK_INTERVAL_MS = 60 * 1000;
const SERVER_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastServerCheckAt = 0;
let promptVisible = false;

function localModeEnabled() {
  return localStorage.getItem(LOCAL_MODE_KEY) === "true";
}

function enableLocalMode() {
  localStorage.setItem(LOCAL_MODE_KEY, "true");
  window.GestorCloudSync?.disableAutoSync?.();
}

function disableLocalMode() {
  localStorage.removeItem(LOCAL_MODE_KEY);
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function tokenExpired(session) {
  const token = session?.accessToken;
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const expiresAtMs = Number(payload.exp) * 1000;
  return Date.now() > expiresAtMs - 30 * 1000;
}

function closePrompt() {
  document.getElementById(SESSION_PROMPT_ID)?.remove();
  promptVisible = false;
}

function goToCloudLogin() {
  closePrompt();
  disableLocalMode();
  document.querySelector('[data-tab="settings"]')?.click();
  window.setTimeout(() => {
    document.querySelector('form[data-form="cloud-login"] input[name="email"]')?.focus();
  }, 120);
}

function continueLocal() {
  enableLocalMode();
  closePrompt();
  const root = document.getElementById("alerts");
  if (root) {
    const el = document.createElement("div");
    el.className = "alert";
    el.textContent = "Modo local activado. La nube, sincronización familiar y funciones premium quedan desactivadas hasta iniciar sesión.";
    root.append(el);
    window.setTimeout(() => el.remove(), 6500);
  }
}

function renderPrompt(reason = "missing") {
  if (promptVisible || localModeEnabled()) return;
  const modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) return;
  promptVisible = true;
  const title = reason === "expired" ? "Tu sesión cloud ha caducado" : "Inicia sesión para usar la nube";
  const detail = reason === "expired"
    ? "Puedes volver a iniciar sesión para recuperar la sincronización familiar, o seguir usando la app solo en este dispositivo."
    : "La app funciona en modo local, pero sin login no tendrá acceso a nube, sincronización entre miembros ni funciones premium futuras.";

  modalRoot.innerHTML = `
    <section id="${SESSION_PROMPT_ID}" class="modal" role="dialog" aria-modal="true" aria-labelledby="cloudSessionTitle">
      <header>
        <div>
          <h2 id="cloudSessionTitle">${title}</h2>
          <p class="muted">${detail}</p>
        </div>
      </header>
      <div class="help-note">
        <p><strong>Modo con cuenta:</strong> sincronización familiar, miembros del hogar, nube y futuras opciones premium.</p>
        <p><strong>Modo local:</strong> tus datos se guardan en este navegador/PWA, sin compartir ni sincronizar.</p>
      </div>
      <div class="actions wrap">
        <button type="button" data-cloud-session-login>Iniciar sesión</button>
        <button type="button" class="secondary" data-cloud-session-local>Seguir sin login</button>
      </div>
    </section>
  `;
  modalRoot.querySelector("[data-cloud-session-login]")?.addEventListener("click", goToCloudLogin);
  modalRoot.querySelector("[data-cloud-session-local]")?.addEventListener("click", continueLocal);
  modalRoot.querySelector("button")?.focus();
}

async function validateServerSession(session) {
  if (!session?.accessToken || !window.GestorCloudAPI?.fetchCurrentCloudUser) return;
  if (Date.now() - lastServerCheckAt < SERVER_CHECK_INTERVAL_MS) return;
  lastServerCheckAt = Date.now();
  try {
    await window.GestorCloudAPI.fetchCurrentCloudUser();
  } catch (error) {
    if (error?.status === 401 || error?.code === "invalid_token" || error?.code === "missing_token") {
      window.GestorCloudAPI.clearCloudSession?.();
      window.GestorCloudSync?.disableAutoSync?.();
      renderPrompt("expired");
    }
  }
}

async function checkCloudSession() {
  const api = window.GestorCloudAPI;
  if (!api?.isCloudConfigured?.()) return;
  const session = api.getCloudSession?.();

  if (session?.accessToken) {
    disableLocalMode();
    if (tokenExpired(session)) {
      api.clearCloudSession?.();
      window.GestorCloudSync?.disableAutoSync?.();
      renderPrompt("expired");
      return;
    }
    await validateServerSession(session);
    return;
  }

  if (!localModeEnabled()) renderPrompt("missing");
}

window.GestorCloudSessionGuard = {
  check: checkCloudSession,
  showLoginPrompt: renderPrompt,
  continueLocal,
  enableLocalMode,
  disableLocalMode,
  isLocalMode: localModeEnabled
};

window.addEventListener("load", () => {
  window.setTimeout(() => checkCloudSession().catch(console.warn), 900);
  window.setInterval(() => checkCloudSession().catch(console.warn), CHECK_INTERVAL_MS);
});

window.addEventListener("online", () => {
  checkCloudSession().catch(console.warn);
});
