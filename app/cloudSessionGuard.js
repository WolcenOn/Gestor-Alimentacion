const LOCAL_MODE_KEY = "gestorMenuSemanal.cloudLocalMode.v1";
const SESSION_PROMPT_ID = "cloudSessionPrompt";
const CHECK_INTERVAL_MS = 60 * 1000;
const SERVER_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastServerCheckAt = 0;
let promptVisible = false;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

function goToCloudSettings() {
  closePrompt();
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

function setPromptError(message) {
  const box = document.querySelector(`#${SESSION_PROMPT_ID} [data-cloud-login-error]`);
  if (!box) return;
  box.textContent = message || "No se pudo iniciar sesión.";
  box.hidden = false;
}

function setPromptBusy(isBusy) {
  const prompt = document.getElementById(SESSION_PROMPT_ID);
  if (!prompt) return;
  prompt.querySelectorAll("button, input").forEach(element => { element.disabled = Boolean(isBusy); });
  const submit = prompt.querySelector("[data-cloud-login-submit]");
  if (submit) submit.textContent = isBusy ? "Entrando..." : "Entrar y sincronizar";
}

async function submitPromptLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    setPromptError("Introduce email y contraseña.");
    return;
  }
  if (!window.GestorCloudAPI?.loginCloudAccount) {
    setPromptError("El módulo cloud todavía no está listo. Recarga la app e inténtalo de nuevo.");
    return;
  }
  setPromptBusy(true);
  try {
    await window.GestorCloudAPI.loginCloudAccount({ email, password });
    disableLocalMode();
    closePrompt();
    await window.GestorCloudSync?.startAutoSync?.();
    document.querySelector('[data-tab="settings"]')?.click();
    const root = document.getElementById("alerts");
    if (root) {
      const el = document.createElement("div");
      el.className = "alert";
      el.textContent = "Sesión iniciada. La nube y la sincronización familiar vuelven a estar activas.";
      root.append(el);
      window.setTimeout(() => el.remove(), 6500);
    }
  } catch (error) {
    setPromptBusy(false);
    setPromptError(error?.message || "Email o contraseña incorrectos.");
  }
}

function renderPrompt(reason = "missing", prefillEmail = "") {
  if (promptVisible || localModeEnabled()) return;
  const modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) return;
  promptVisible = true;
  const title = reason === "expired" ? "Tu sesión cloud ha caducado" : "Inicia sesión para usar la nube";
  const detail = reason === "expired"
    ? "Vuelve a entrar para recuperar la sincronización familiar, o sigue usando la app solo en este dispositivo."
    : "La app puede funcionar en modo local, pero sin login no tendrá acceso a nube, sincronización entre miembros ni funciones premium futuras.";

  modalRoot.innerHTML = `
    <section id="${SESSION_PROMPT_ID}" class="modal" role="dialog" aria-modal="true" aria-labelledby="cloudSessionTitle">
      <header>
        <div>
          <h2 id="cloudSessionTitle">${escapeHtml(title)}</h2>
          <p class="muted">${escapeHtml(detail)}</p>
        </div>
      </header>

      <form data-cloud-login-prompt autocomplete="on">
        <div class="form-grid">
          <label>Email
            <input name="email" type="email" autocomplete="email" inputmode="email" value="${escapeHtml(prefillEmail)}" required>
          </label>
          <label>Contraseña
            <input name="password" type="password" autocomplete="current-password" required>
          </label>
        </div>
        <p class="alert error" data-cloud-login-error hidden></p>
        <div class="actions wrap">
          <button type="submit" data-cloud-login-submit>Entrar y sincronizar</button>
          <button type="button" class="secondary" data-cloud-session-local>Seguir sin login</button>
          <button type="button" class="ghost" data-cloud-settings>Crear cuenta / ajustes</button>
        </div>
      </form>

      <div class="help-note">
        <p><strong>Con cuenta:</strong> sincronización familiar, nube, miembros del hogar y futuras opciones premium.</p>
        <p><strong>Modo local:</strong> los datos se guardan solo en este navegador/PWA.</p>
      </div>
    </section>
  `;
  modalRoot.querySelector("[data-cloud-login-prompt]")?.addEventListener("submit", submitPromptLogin);
  modalRoot.querySelector("[data-cloud-session-local]")?.addEventListener("click", continueLocal);
  modalRoot.querySelector("[data-cloud-settings]")?.addEventListener("click", goToCloudSettings);
  modalRoot.querySelector('input[name="email"]')?.focus();
}

async function validateServerSession(session) {
  if (!session?.accessToken || !window.GestorCloudAPI?.fetchCurrentCloudUser) return;
  if (Date.now() - lastServerCheckAt < SERVER_CHECK_INTERVAL_MS) return;
  lastServerCheckAt = Date.now();
  try {
    await window.GestorCloudAPI.fetchCurrentCloudUser();
  } catch (error) {
    if (error?.status === 401 || error?.code === "invalid_token" || error?.code === "missing_token") {
      const email = window.GestorCloudAPI.getCloudSession?.()?.user?.email || "";
      window.GestorCloudAPI.clearCloudSession?.();
      window.GestorCloudSync?.disableAutoSync?.();
      renderPrompt("expired", email);
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
      const email = session?.user?.email || "";
      api.clearCloudSession?.();
      window.GestorCloudSync?.disableAutoSync?.();
      renderPrompt("expired", email);
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
