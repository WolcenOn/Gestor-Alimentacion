import { getState, setState, subscribe } from "./store.js";
import {
  ApiError,
  fetchHouseholdSync,
  getCloudSession,
  isCloudConfigured,
  isLoggedIn
} from "./apiClient.js";

const STATUS_KEY = "gestorMenuSemanal.cloudSyncStatus.v1";
const CLOUD_SCHEMA_VERSION = 1;
const AUTO_SAVE_DELAY_MS = 2200;
const REMOTE_POLL_MS = 15000;
const DEFAULT_TIMEOUT_MS = 12000;

let status = loadStatus();
let pendingSaveTimer = null;
let pollTimer = null;
let autoSyncEnabled = false;
let suppressNextSave = false;
let dirtyLocalChanges = Boolean(status.pendingLocalChanges);
let syncing = false;
let unsubscribeStore = null;

function loadStatus() {
  try {
    return { ...defaultStatus(), ...(JSON.parse(localStorage.getItem(STATUS_KEY) || "null") || {}) };
  } catch (error) {
    console.warn("No se pudo leer el estado de sincronización", error);
    return defaultStatus();
  }
}

function defaultStatus() {
  return {
    mode: "local",
    lastSyncAt: null,
    lastError: null,
    householdId: null,
    householdName: null,
    updatedAt: null,
    role: null,
    pendingLocalChanges: false,
    pendingSince: null,
    lastAttemptAt: null,
    retryCount: 0
  };
}

function saveStatus() {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  window.dispatchEvent(new CustomEvent("gestor:cloud-sync-status", { detail: getCloudSyncStatus() }));
}

function setStatus(next) {
  status = { ...status, ...next };
  saveStatus();
}

function apiBaseUrl() {
  const config = window.APP_CONFIG || window.GESTOR_APP_CONFIG || {};
  return String(config.API_BASE_URL || config.apiBaseUrl || "").trim().replace(/\/+$/, "");
}

async function saveHouseholdSyncWithPrecondition(householdId, body) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new ApiError("El backend cloud no está configurado.", { code: "cloud_not_configured" });

  const session = getCloudSession();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (session?.accessToken) headers.set("Authorization", "Bearer " + session.accessToken);

  try {
    const response = await fetch(`${baseUrl}/households/${encodeURIComponent(householdId)}/sync`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
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
    if (error.name === "AbortError") throw new ApiError("La petición al backend ha tardado demasiado.", { code: "timeout" });
    if (error instanceof ApiError) throw error;
    throw new ApiError("No se pudo conectar con el backend.", { code: "network_error", details: error });
  } finally {
    window.clearTimeout(timeout);
  }
}

function currentHousehold() {
  const session = getCloudSession();
  const list = Array.isArray(session?.households) ? session.households : [];
  const activeId = session?.activeHouseholdId || list[0]?.id || null;
  return list.find(household => household.id === activeId) || list[0] || null;
}

function currentHouseholdId() {
  return currentHousehold()?.id || null;
}

function currentRole() {
  return currentHousehold()?.role || null;
}

function currentHouseholdName() {
  return currentHousehold()?.name || null;
}

function canEditCloud(role = currentRole()) {
  return role === "owner" || role === "admin" || role === "member";
}

function cloudStateEnvelope(state) {
  return {
    version: CLOUD_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "gestor-alimentacion",
    state
  };
}

function extractAppState(snapshot) {
  const raw = snapshot?.sync?.state;
  if (!raw || Object.keys(raw).length === 0) return null;
  if (raw.app === "gestor-alimentacion" && raw.state) return raw.state;
  return raw;
}

function remoteUpdatedAt(snapshot) {
  return snapshot?.sync?.updatedAt || null;
}

function isRemoteNewer(remoteAt) {
  if (!remoteAt) return false;
  if (!status.updatedAt) return true;
  return new Date(remoteAt).getTime() > new Date(status.updatedAt).getTime();
}

function statusContext() {
  return {
    householdId: currentHouseholdId(),
    householdName: currentHouseholdName(),
    role: currentRole()
  };
}

function markLocalChangesPending() {
  dirtyLocalChanges = true;
  setStatus({
    mode: "pending",
    ...statusContext(),
    pendingLocalChanges: true,
    pendingSince: status.pendingSince || new Date().toISOString(),
    lastError: null
  });
}

function clearPendingLocalChanges(nextStatus = {}) {
  dirtyLocalChanges = false;
  setStatus({
    pendingLocalChanges: false,
    pendingSince: null,
    retryCount: 0,
    ...nextStatus
  });
}

function markSyncAttempt() {
  setStatus({
    mode: "syncing",
    ...statusContext(),
    lastAttemptAt: new Date().toISOString(),
    lastError: null
  });
}

function markSyncError(error) {
  setStatus({
    mode: dirtyLocalChanges ? "pending" : "error",
    ...statusContext(),
    lastError: error.message || String(error),
    retryCount: (status.retryCount || 0) + 1
  });
}

function preventUnsafePull({ apply, force }) {
  if (apply && dirtyLocalChanges && !force) {
    throw new ApiError("Hay cambios locales pendientes. Sube primero esos cambios o exporta tus datos antes de descargar desde la nube.", {
      code: "pending_local_changes"
    });
  }
}

export function getCloudSyncStatus() {
  return structuredClone(status);
}

export function canUseCloudSync() {
  return isCloudConfigured() && isLoggedIn() && Boolean(currentHouseholdId());
}

export function canWriteCloudSync() {
  return canUseCloudSync() && canEditCloud();
}

export async function pullCloudState({ apply = true, onlyIfNewer = false, force = false } = {}) {
  const householdId = currentHouseholdId();
  const role = currentRole();
  const householdName = currentHouseholdName();
  if (!isCloudConfigured()) throw new ApiError("Cloud no configurado.", { code: "cloud_not_configured" });
  if (!isLoggedIn()) throw new ApiError("No hay sesión cloud.", { code: "not_logged_in" });
  if (!householdId) throw new ApiError("No hay hogar activo.", { code: "missing_household" });
  preventUnsafePull({ apply, force });

  markSyncAttempt();
  syncing = true;
  try {
    const snapshot = await fetchHouseholdSync(householdId);
    const appState = extractAppState(snapshot);
    const remoteAt = remoteUpdatedAt(snapshot);
    const shouldApply = apply && appState && (!onlyIfNewer || isRemoteNewer(remoteAt));
    if (shouldApply) {
      suppressNextSave = true;
      setState(appState, "cloud-pull");
      dirtyLocalChanges = false;
    }
    setStatus({
      mode: dirtyLocalChanges ? "pending" : "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      householdName,
      role,
      updatedAt: remoteAt || status.updatedAt || null,
      pendingLocalChanges: dirtyLocalChanges,
      pendingSince: dirtyLocalChanges ? status.pendingSince : null
    });
    return snapshot;
  } catch (error) {
    markSyncError(error);
    throw error;
  } finally {
    syncing = false;
  }
}

export async function pushCloudState({ state = getState() } = {}) {
  const householdId = currentHouseholdId();
  const role = currentRole();
  const householdName = currentHouseholdName();
  if (!isCloudConfigured()) throw new ApiError("Cloud no configurado.", { code: "cloud_not_configured" });
  if (!isLoggedIn()) throw new ApiError("No hay sesión cloud.", { code: "not_logged_in" });
  if (!householdId) throw new ApiError("No hay hogar activo.", { code: "missing_household" });
  if (!canEditCloud(role)) throw new ApiError("Tu rol permite consultar, pero no modificar la nube.", { code: "read_only_role" });

  markSyncAttempt();
  syncing = true;
  try {
    const snapshot = await saveHouseholdSyncWithPrecondition(householdId, {
      version: CLOUD_SCHEMA_VERSION,
      state: cloudStateEnvelope(state),
      expectedUpdatedAt: status.updatedAt || null
    });
    clearPendingLocalChanges({
      mode: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      householdName,
      role,
      updatedAt: remoteUpdatedAt(snapshot) || null
    });
    return snapshot;
  } catch (error) {
    markSyncError(error);
    throw error;
  } finally {
    syncing = false;
  }
}

export async function resolvePendingCloudChanges() {
  if (!dirtyLocalChanges) return { status: getCloudSyncStatus(), skipped: true };
  const snapshot = await pushCloudState();
  return { snapshot, status: getCloudSyncStatus(), skipped: false };
}

export function scheduleCloudPush() {
  if (!autoSyncEnabled || !canWriteCloudSync()) return;
  markLocalChangesPending();
  window.clearTimeout(pendingSaveTimer);
  pendingSaveTimer = window.setTimeout(() => {
    resolvePendingCloudChanges().catch(error => console.warn("No se pudo sincronizar con la nube", error));
  }, AUTO_SAVE_DELAY_MS);
}

async function initialCloudSync() {
  if (!canUseCloudSync()) return;
  const householdId = currentHouseholdId();
  const role = currentRole();
  const householdName = currentHouseholdName();
  try {
    if (dirtyLocalChanges && canEditCloud(role)) {
      await resolvePendingCloudChanges();
      return;
    }

    const snapshot = await fetchHouseholdSync(householdId);
    const appState = extractAppState(snapshot);
    const remoteAt = remoteUpdatedAt(snapshot);
    if (appState) {
      suppressNextSave = true;
      setState(appState, "cloud-pull");
      clearPendingLocalChanges({ mode: "synced", lastSyncAt: new Date().toISOString(), lastError: null, householdId, householdName, role, updatedAt: remoteAt || null });
      return;
    }
    if (canEditCloud(role)) {
      await pushCloudState();
    } else {
      clearPendingLocalChanges({ mode: "synced", lastSyncAt: new Date().toISOString(), lastError: null, householdId, householdName, role, updatedAt: remoteAt || null });
    }
  } catch (error) {
    markSyncError(error);
    console.warn("No se pudo hacer la sincronización inicial", error);
  }
}

async function pollRemoteChanges() {
  if (!autoSyncEnabled || !canUseCloudSync() || syncing || dirtyLocalChanges) return;
  try {
    await pullCloudState({ apply: true, onlyIfNewer: true });
  } catch (error) {
    console.warn("No se pudieron comprobar cambios remotos", error);
  }
}

function startPolling() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(pollRemoteChanges, REMOTE_POLL_MS);
}

export function enableCloudAutoSync() {
  if (!canUseCloudSync()) return;
  if (!autoSyncEnabled) {
    autoSyncEnabled = true;
    if (!unsubscribeStore) {
      unsubscribeStore = subscribe((_, reason) => {
        if (reason === "cloud-pull" || suppressNextSave) {
          suppressNextSave = false;
          return;
        }
        scheduleCloudPush();
      });
    }
    startPolling();
  }
  setStatus({ mode: dirtyLocalChanges ? "pending" : "ready", ...statusContext(), lastError: null, pendingLocalChanges: dirtyLocalChanges });
}

export async function startCloudAutoSync() {
  enableCloudAutoSync();
  await initialCloudSync();
}

export function disableCloudAutoSync() {
  autoSyncEnabled = false;
  window.clearTimeout(pendingSaveTimer);
  window.clearInterval(pollTimer);
  setStatus({ mode: "local" });
}

export function markCloudLocalMode() {
  disableCloudAutoSync();
  setStatus({ mode: "local", lastError: null });
}

window.GestorCloudSync = {
  getStatus: getCloudSyncStatus,
  canUse: canUseCloudSync,
  canWrite: canWriteCloudSync,
  pull: pullCloudState,
  push: pushCloudState,
  resolvePending: resolvePendingCloudChanges,
  enableAutoSync: enableCloudAutoSync,
  startAutoSync: startCloudAutoSync,
  disableAutoSync: disableCloudAutoSync
};

window.addEventListener("load", () => {
  window.setTimeout(() => {
    startCloudAutoSync().catch(error => console.warn("No se pudo iniciar autosync", error));
  }, 600);
});

window.addEventListener("online", () => {
  if (dirtyLocalChanges && canWriteCloudSync()) {
    resolvePendingCloudChanges().catch(error => console.warn("No se pudieron subir cambios pendientes", error));
    return;
  }
  startCloudAutoSync().catch(error => console.warn("No se pudo reanudar autosync", error));
});

window.addEventListener("gestor:cloud-session", () => {
  disableCloudAutoSync();
  window.setTimeout(() => startCloudAutoSync().catch(error => console.warn("No se pudo reiniciar autosync", error)), 100);
});
