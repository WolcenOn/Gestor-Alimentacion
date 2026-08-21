const SESSION_KEY = "gestorMenuSemanal.cloudSession.v1";
const DEFAULT_TIMEOUT_MS = 12000;

function readRuntimeConfig() {
  return window.APP_CONFIG || window.GESTOR_APP_CONFIG || {};
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null") || null;
  } catch (error) {
    console.warn("No se pudo leer la sesión cloud", error);
    return null;
  }
}

function saveSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

let session = loadSession();

export function getApiBaseUrl() {
  const config = readRuntimeConfig();
  return normalizeBaseUrl(config.API_BASE_URL || config.apiBaseUrl || "");
}

export function isCloudConfigured() {
  return Boolean(getApiBaseUrl());
}

export function getCloudSession() {
  return session ? structuredClone(session) : null;
}

export function isLoggedIn() {
  return Boolean(session?.accessToken);
}

export function clearCloudSession() {
  session = null;
  saveSession(null);
}

export function setCloudSession(nextSession) {
  session = nextSession ? structuredClone(nextSession) : null;
  saveSession(session);
  return getCloudSession();
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = "api_error", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError("El backend cloud no está configurado.", { code: "cloud_not_configured" });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (session?.accessToken && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${session.accessToken}`);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    const contentType = response.headers.get("Content-Type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const apiError = payload?.error || {};
      throw new ApiError(apiError.message || `Error HTTP ${response.status}`, {
        status: response.status,
        code: apiError.code || "http_error",
        details: payload
      });
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("La petición al backend ha tardado demasiado.", { code: "timeout" });
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("No se pudo conectar con el backend.", { code: "network_error", details: error });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function registerCloudAccount({ email, password, displayName, householdName }) {
  const payload = await request("/auth/register", {
    method: "POST",
    body: { email, password, displayName, householdName }
  });
  setCloudSession(payload);
  return payload;
}

export async function loginCloudAccount({ email, password }) {
  const payload = await request("/auth/login", {
    method: "POST",
    body: { email, password }
  });
  setCloudSession(payload);
  return payload;
}

export async function requestPasswordReset(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email }
  });
}

export async function resetPassword({ token, password }) {
  return request("/auth/reset-password", {
    method: "POST",
    body: { token, password }
  });
}

export async function fetchCurrentCloudUser() {
  return request("/me");
}

export async function listCloudHouseholds() {
  return request("/households");
}

export async function createCloudHousehold(name) {
  return request("/households", {
    method: "POST",
    body: { name }
  });
}

export async function fetchHouseholdSync(householdId) {
  return request(`/households/${encodeURIComponent(householdId)}/sync`);
}

export async function saveHouseholdSync(householdId, { version = 1, state, expectedUpdatedAt = null }) {
  return request(`/households/${encodeURIComponent(householdId)}/sync`, {
    method: "PUT",
    body: { version, state, expectedUpdatedAt }
  });
}

export async function createHouseholdInvite(householdId, { email, role = "member" }) {
  return request(`/households/${encodeURIComponent(householdId)}/invites`, {
    method: "POST",
    body: { email, role }
  });
}

export async function acceptHouseholdInvite(token) {
  return request(`/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
}

const GestorCloudAPI = {
  getApiBaseUrl,
  isCloudConfigured,
  getCloudSession,
  isLoggedIn,
  clearCloudSession,
  setCloudSession,
  registerCloudAccount,
  loginCloudAccount,
  requestPasswordReset,
  resetPassword,
  fetchCurrentCloudUser,
  listCloudHouseholds,
  createCloudHousehold,
  fetchHouseholdSync,
  saveHouseholdSync,
  createHouseholdInvite,
  acceptHouseholdInvite
};

window.GestorCloudAPI = GestorCloudAPI;

export default GestorCloudAPI;