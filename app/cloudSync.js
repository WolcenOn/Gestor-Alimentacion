import { getState, setState, subscribe } from "./store.js";
import { compareCloudStates, cloudConflictReviewText } from "./cloudConflictReview.js";
import { downloadTextFile } from "./utils.js";
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
let dirtyLocalChanges = Boolean(status.pendingLocalChanges);
let localEditRevision = 0;
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
  const remoteMs = new Date(remoteAt).getTime();
  const localMs = new Date(status.updatedAt).getTime();
  // PostgreSQL timestamps are microsecond-precise; Date loses that precision.
  return remoteMs > localMs || (remoteMs === localMs && remoteAt !== status.updatedAt);
}

function statusContext() {
  return {
    householdId: currentHouseholdId(),
    householdName: currentHouseholdName(),
    role: currentRole()
  };
}

function markLocalChangesPending() {
  localEditRevision += 1;
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

// A preview never changes the stored remote version token. Otherwise a pending
// local edit could be uploaded against the version just fetched, bypassing CAS.
export async function previewCloudDifferences() {
  if (!canUseCloudSync()) throw new ApiError("Inicia sesión y selecciona un hogar antes de comparar.", { code:"cloud_not_ready" });
  const householdId = currentHouseholdId();
  const snapshot = await fetchHouseholdSync(householdId);
  const remoteState = extractAppState(snapshot) || {};
  const comparison = compareCloudStates(getState(), remoteState);
  const result = {
    ...comparison,
    remoteUpdatedAt:remoteUpdatedAt(snapshot),
    knownUpdatedAt:status.householdId === householdId ? status.updatedAt : null,
    pendingLocalChanges:dirtyLocalChanges
  };
  return { ...result, summary:cloudConflictReviewText(result) };
}

// Explicit destructive resolution: make a personal JSON backup FIRST, then
// ask the user whether to replace their local work with the remote snapshot.
// Keep the existing "pending" state intact if cancelled or if reading fails.
export async function adoptRemoteWithBackup() {
  if (!canUseCloudSync()) throw new ApiError("Necesitas una sesión cloud para consultar el hogar.", { code:"cloud_not_ready" });
  if (syncing) throw new ApiError("Hay otra sincronización en curso.", { code:"sync_in_progress" });
  const householdId = currentHouseholdId();
  const snapshot = await fetchHouseholdSync(householdId);
  const appState = extractAppState(snapshot);
  if (!appState) throw new ApiError("La nube todavía no contiene datos que recuperar.", { code:"cloud_empty" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadTextFile(`gestor-alimentacion-copia-local-${stamp}.json`, JSON.stringify(getState(), null, 2));
  const accepted = window.confirm("Se ha preparado una copia JSON de tus datos locales. Comprueba que el navegador la haya descargado antes de continuar. Si aceptas, los datos locales se sustituirán por los de la nube. ¿Continuar?");
  if (!accepted) return { applied:false };
  suppressNextSave = true;
  try {
    setState(appState, "cloud-pull");
  } catch (error) {
    suppressNextSave = false;
    throw error;
  }
  clearPendingLocalChanges({
    mode:"synced",
    lastSyncAt:new Date().toISOString(),
    lastError:null,
    ...statusContext(),
    updatedAt:remoteUpdatedAt(snapshot)
  });
  return { applied:true };
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
  if (syncing) throw new ApiError("Ya hay una sincronización en curso.", { code: "sync_in_progress" });

  // A manual push must also remain pending if the server returns 409.
  // Do not reuse another household's last-known token after changing accounts.
  const expectedUpdatedAt = status.householdId === householdId ? status.updatedAt || null : null;
  markLocalChangesPending();
  const revisionAtUpload = localEditRevision;
  markSyncAttempt();
  syncing = true;
  try {
    const snapshot = await saveHouseholdSync(householdId, {
      version: CLOUD_SCHEMA_VERSION,
      state: cloudStateEnvelope(state),
      expectedUpdatedAt
    });
    const nextStatus = {
      mode: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      householdId,
      householdName,
      role,
      updatedAt: remoteUpdatedAt(snapshot) || null
    };
    if (revisionAtUpload === localEditRevision) {
      clearPendingLocalChanges(nextStatus);
    } else {
      // Edits performed during the network request are not included in its body.
      setStatus({ ...nextStatus, mode: "pending", pendingLocalChanges: true });
    }
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
  preview: previewCloudDifferences,
  adoptRemoteWithBackup,
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