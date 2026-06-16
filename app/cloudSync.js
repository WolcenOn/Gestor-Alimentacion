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
const AUTO_SAVE_DELAY_MS = 2500;

let status = loadStatus();
let pendingSaveTimer = null;
let autoSyncEnabled = false;
let suppressNextSave = false;

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
    updatedAt: null
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

function currentHouseholdId() {
  const session = getCloudSession();
  return session?.activeHouseholdId || session?.households?.[0]?.id || status.householdId || null;
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

export function getCloudSyncStatus() {
  return structuredClone(status);
}

export function canUseCloudSync() {
  return isCloudConfigured() && isLoggedIn() && Boolean(currentHouseholdId());
}

export async function pullCloudState({ apply = true } = {}) {
  const householdId = currentHouseholdId();
  if (!isCloudConfigured()) throw new ApiError("Cloud no configurado.", { code: "cloud_not_configured" });
  if (!isLoggedIn()) throw new ApiError("No hay sesión cloud.", { code: "not_logged_in" });
  if (!householdId) throw new ApiError("No hay hogar activo.", { code: "missing_household" });

  setStatus({ mode: "syncing", lastError: null, householdId });
  try {
    const snapshot = await fetchHouseholdSync(householdId);
    const appState = extractAppState(snapshot);
    if (apply && appState) {
      suppressNextSave = true;
      setState(appState, "cloud-pull");
    }
    setStatus({
      mode: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      updatedAt: snapshot?.sync?.updatedAt || null
    });
    return snapshot;
  } catch (error) {
    setStatus({ mode: "error", lastError: error.message || String(error), householdId });
    throw error;
  }
}

export async function pushCloudState({ state = getState() } = {}) {
  const householdId = currentHouseholdId();
  if (!isCloudConfigured()) throw new ApiError("Cloud no configurado.", { code: "cloud_not_configured" });
  if (!isLoggedIn()) throw new ApiError("No hay sesión cloud.", { code: "not_logged_in" });
  if (!householdId) throw new ApiError("No hay hogar activo.", { code: "missing_household" });

  setStatus({ mode: "syncing", lastError: null, householdId });
  try {
    const snapshot = await saveHouseholdSync(householdId, {
      version: CLOUD_SCHEMA_VERSION,
      state: cloudStateEnvelope(state)
    });
    setStatus({
      mode: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      updatedAt: snapshot?.sync?.updatedAt || null
    });
    return snapshot;
  } catch (error) {
    setStatus({ mode: "error", lastError: error.message || String(error), householdId });
    throw error;
  }
}

export function scheduleCloudPush() {
  if (!autoSyncEnabled || !canUseCloudSync()) return;
  window.clearTimeout(pendingSaveTimer);
  pendingSaveTimer = window.setTimeout(() => {
    pushCloudState().catch(error => console.warn("No se pudo sincronizar con la nube", error));
  }, AUTO_SAVE_DELAY_MS);
}

export function enableCloudAutoSync() {
  if (autoSyncEnabled) return;
  autoSyncEnabled = true;
  subscribe((_, reason) => {
    if (reason === "cloud-pull" || suppressNextSave) {
      suppressNextSave = false;
      return;
    }
    scheduleCloudPush();
  });
  if (canUseCloudSync()) setStatus({ mode: "ready", householdId: currentHouseholdId(), lastError: null });
}

export function disableCloudAutoSync() {
  autoSyncEnabled = false;
  window.clearTimeout(pendingSaveTimer);
  setStatus({ mode: "local" });
}

export function markCloudLocalMode() {
  disableCloudAutoSync();
  setStatus({ mode: "local", lastError: null });
}

window.GestorCloudSync = {
  getStatus: getCloudSyncStatus,
  canUse: canUseCloudSync,
  pull: pullCloudState,
  push: pushCloudState,
  enableAutoSync: enableCloudAutoSync,
  disableAutoSync: disableCloudAutoSync
};
