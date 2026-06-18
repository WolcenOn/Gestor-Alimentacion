import { getState, setState, subscribe } from "./store.js";
import {
  ApiError,
  fetchHouseholdSync,
  getCloudSession,
  isCloudConfigured,
  isLoggedIn,
  saveHouseholdSync
} from "./apiClient.js";

const STATUS_KEY = "gestorMenuSemanal.cloudSyncStatus.v1";
const CLOUD_SCHEMA_VERSION = 1;
const AUTO_SAVE_DELAY_MS = 2200;
const REMOTE_POLL_MS = 15000;

let status = loadStatus();
let pendingSaveTimer = null;
let pollTimer = null;
let autoSyncEnabled = false;
let suppressNextSave = false;
let dirtyLocalChanges = false;
let syncing = false;
let unsubscribeStore = null;

function loadStatus() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) || "null") || defaultStatus();
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
    updatedAt: null,
    role: null
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

function currentHousehold() {
  const session = getCloudSession();
  const activeId = session?.activeHouseholdId || status.householdId || session?.households?.[0]?.id || null;
  return session?.households?.find(household => household.id === activeId) || session?.households?.[0] || null;
}

function currentHouseholdId() {
  return currentHousehold()?.id || null;
}

function currentRole() {
  return currentHousehold()?.role || null;
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

export function getCloudSyncStatus() {
  return structuredClone(status);
}

export function canUseCloudSync() {
  return isCloudConfigured() && isLoggedIn() && Boolean(currentHouseholdId());
}

export function canWriteCloudSync() {
  return canUseCloudSync() && canEditCloud();
}

export async function pullCloudState({ apply = true, onlyIfNewer = false } = {}) {
  const householdId = currentHouseholdId();
  const role = currentRole();
  if (!isCloudConfigured()) throw new ApiError("Cloud no configurado.", { code: "cloud_not_configured" });
  if (!isLoggedIn()) throw new ApiError("No hay sesión cloud.", { code: "not_logged_in" });
  if (!householdId) throw new ApiError("No hay hogar activo.", { code: "missing_household" });

  setStatus({ mode: "syncing", lastError: null, householdId, role });
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
      mode: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      role,
      updatedAt: remoteAt || status.updatedAt || null
    });
    return snapshot;
  } catch (error) {
    setStatus({ mode: "error", lastError: error.message || String(error), householdId, role });
    throw error;
  } finally {
    syncing = false;
  }
}

export async function pushCloudState({ state = getState() } = {}) {
  const householdId = currentHouseholdId();
  const role = currentRole();
  if (!isCloudConfigured()) throw new ApiError("Cloud no configurado.", { code: "cloud_not_configured" });
  if (!isLoggedIn()) throw new ApiError("No hay sesión cloud.", { code: "not_logged_in" });
  if (!householdId) throw new ApiError("No hay hogar activo.", { code: "missing_household" });
  if (!canEditCloud(role)) throw new ApiError("Tu rol permite consultar, pero no modificar la nube.", { code: "read_only_role" });

  setStatus({ mode: "syncing", lastError: null, householdId, role });
  syncing = true;
  try {
    const snapshot = await saveHouseholdSync(householdId, {
      version: CLOUD_SCHEMA_VERSION,
      state: cloudStateEnvelope(state)
    });
    dirtyLocalChanges = false;
    setStatus({
      mode: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      role,
      updatedAt: remoteUpdatedAt(snapshot) || null
    });
    return snapshot;
  } catch (error) {
    setStatus({ mode: "error", lastError: error.message || String(error), householdId, role });
    throw error;
  } finally {
    syncing = false;
  }
}

export function scheduleCloudPush() {
  if (!autoSyncEnabled || !canWriteCloudSync()) return;
  dirtyLocalChanges = true;
  window.clearTimeout(pendingSaveTimer);
  pendingSaveTimer = window.setTimeout(() => {
    pushCloudState().catch(error => console.warn("No se pudo sincronizar con la nube", error));
  }, AUTO_SAVE_DELAY_MS);
}

async function initialCloudSync() {
  if (!canUseCloudSync()) return;
  const householdId = currentHouseholdId();
  const role = currentRole();
  try {
    const snapshot = await fetchHouseholdSync(householdId);
    const appState = extractAppState(snapshot);
    const remoteAt = remoteUpdatedAt(snapshot);
    if (appState) {
      suppressNextSave = true;
      setState(appState, "cloud-pull");
      dirtyLocalChanges = false;
      setStatus({ mode: "synced", lastSyncAt: new Date().toISOString(), lastError: null, householdId, role, updatedAt: remoteAt || null });
      return;
    }
    if (canEditCloud(role)) {
      await pushCloudState();
    } else {
      setStatus({ mode: "synced", lastSyncAt: new Date().toISOString(), lastError: null, householdId, role, updatedAt: remoteAt || null });
    }
  } catch (error) {
    setStatus({ mode: "error", lastError: error.message || String(error), householdId, role });
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
  setStatus({ mode: "ready", householdId: currentHouseholdId(), role: currentRole(), lastError: null });
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
  startCloudAutoSync().catch(error => console.warn("No se pudo reanudar autosync", error));
});
