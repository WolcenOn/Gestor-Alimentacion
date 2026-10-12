import assert from "node:assert/strict";

const localStorageMock = (() => {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
  };
})();

globalThis.localStorage = localStorageMock;
globalThis.window = globalThis;
globalThis.APP_CONFIG = { API_BASE_URL: "https://api.example.test" };
globalThis.CustomEvent ||= class CustomEvent extends Event {
  constructor(type, params = {}) {
    super(type);
    this.detail = params.detail;
  }
};

const listeners = new Map();
globalThis.addEventListener = (type, handler) => {
  const list = listeners.get(type) || [];
  list.push(handler);
  listeners.set(type, list);
};
globalThis.dispatchEvent = event => {
  for (const handler of listeners.get(event.type) || []) handler(event);
  return true;
};
globalThis.setTimeout = () => 1;
globalThis.clearTimeout = () => {};
globalThis.setInterval = () => 1;
globalThis.clearInterval = () => {};

const session = {
  accessToken: "unit-test-token",
  user: { id: "user_test", email: "test@example.test" },
  activeHouseholdId: "household_test",
  households: [{ id: "household_test", name: "Casa test", role: "owner" }]
};

const knownRemoteUpdatedAt = "2026-06-19T15:00:00.000Z";
localStorage.setItem("gestorMenuSemanal.cloudSession.v1", JSON.stringify(session));
localStorage.setItem("gestorMenuSemanal.cloudSyncStatus.v1", JSON.stringify({
  mode: "synced",
  householdId: "household_test",
  householdName: "Casa test",
  role: "owner",
  updatedAt: knownRemoteUpdatedAt,
  pendingLocalChanges: false
}));

const { updateState } = await import("../store.js");
const { ApiError } = await import("../apiClient.js");
const {
  enableCloudAutoSync,
  getCloudSyncStatus,
  pullCloudState,
  resolvePendingCloudChanges,
  pushCloudState,
  previewCloudDifferences,
  adoptRemoteWithBackup
} = await import("../cloudSync.js");

enableCloudAutoSync();

updateState(state => {
  state.settings.cloudSyncUnitTest = true;
}, "unit-test-local-change");

let status = getCloudSyncStatus();
assert.equal(status.pendingLocalChanges, true);
assert.equal(status.mode, "pending");
assert.ok(status.pendingSince);

await assert.rejects(
  () => pullCloudState({ apply: true }),
  error => error instanceof ApiError && error.code === "pending_local_changes"
);

let fetchCalls = 0;
globalThis.fetch = async (url, options = {}) => {
  fetchCalls += 1;
  assert.match(String(url), /\/households\/household_test\/sync$/);
  assert.equal(options.method, "PUT");
  const body = JSON.parse(options.body);
  assert.equal(body.expectedUpdatedAt, knownRemoteUpdatedAt);
  return new Response(JSON.stringify({ sync: { updatedAt: "2026-06-19T16:00:00.000Z" } }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const resolved = await resolvePendingCloudChanges();
status = getCloudSyncStatus();
assert.equal(resolved.skipped, false);
assert.equal(fetchCalls, 1);
assert.equal(status.pendingLocalChanges, false);
assert.equal(status.mode, "synced");
assert.equal(status.retryCount, 0);
assert.equal(status.updatedAt, "2026-06-19T16:00:00.000Z");

const noPending = await resolvePendingCloudChanges();
assert.equal(noPending.skipped, true);
assert.equal(fetchCalls, 1);

updateState(state => {
  state.settings.cloudSyncConflictTest = true;
}, "unit-test-conflicting-change");

globalThis.fetch = async (url, options = {}) => {
  fetchCalls += 1;
  assert.match(String(url), /\/households\/household_test\/sync$/);
  assert.equal(options.method, "PUT");
  const body = JSON.parse(options.body);
  assert.equal(body.expectedUpdatedAt, "2026-06-19T16:00:00.000Z");
  return new Response(JSON.stringify({
    error: {
      code: "sync_conflict",
      message: "La nube cambió desde tu última sincronización."
    }
  }), {
    status: 409,
    headers: { "Content-Type": "application/json" }
  });
};

await assert.rejects(
  () => resolvePendingCloudChanges(),
  error => error instanceof ApiError && error.status === 409 && error.code === "sync_conflict"
);
status = getCloudSyncStatus();
assert.equal(status.pendingLocalChanges, true);
assert.equal(status.mode, "pending");
assert.equal(status.retryCount, 1);
assert.match(status.lastError, /nube cambió/i);
assert.equal(fetchCalls, 2);

// Manual uploads must not silently clear work when a conflict occurs.
await assert.rejects(
  () => pushCloudState(),
  error => error instanceof ApiError && error.code === "sync_conflict"
);
status = getCloudSyncStatus();
assert.equal(status.pendingLocalChanges, true);
assert.equal(status.mode, "pending");

// A local edit made while a successful upload is in flight also stays pending.
let releaseUpload;
let notifyStarted;
const requestStarted = new Promise(resolve => { notifyStarted = resolve; });
globalThis.fetch = async (_url, options = {}) => {
  const body = JSON.parse(options.body);
  assert.equal(body.expectedUpdatedAt, "2026-06-19T16:00:00.000Z");
  notifyStarted();
  return new Promise(resolve => {
    releaseUpload = () => resolve(new Response(JSON.stringify({
      sync: { updatedAt: "2026-06-19T16:00:00.000001Z" }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  });
};

const inFlightUpload = pushCloudState();
await requestStarted;
updateState(state => {
  state.settings.changedDuringCloudSave = true;
}, "unit-test-in-flight-change");
releaseUpload();
await inFlightUpload;
status = getCloudSyncStatus();
assert.equal(status.pendingLocalChanges, true);
assert.equal(status.mode, "pending");
assert.equal(status.updatedAt, "2026-06-19T16:00:00.000001Z");

globalThis.fetch = async (_url, options = {}) => {
  const body = JSON.parse(options.body);
  assert.equal(body.expectedUpdatedAt, "2026-06-19T16:00:00.000001Z");
  return new Response(JSON.stringify({
    sync: { updatedAt: "2026-06-19T16:00:00.000002Z" }
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
await resolvePendingCloudChanges();
status = getCloudSyncStatus();
assert.equal(status.pendingLocalChanges, false);
assert.equal(status.updatedAt, "2026-06-19T16:00:00.000002Z");

// Preview must never adopt a remote version token; doing so would make a
// pending local upload seem to have read edits from a second device.
updateState(state => {
  state.settings.previewPendingChange = true;
}, "unit-test-preview-pending");
const beforePreview = getCloudSyncStatus();
globalThis.fetch = async (_url, options = {}) => {
  assert.equal(options.method, "GET");
  return new Response(JSON.stringify({
    sync:{
      updatedAt:"2026-06-19T19:00:00.000000Z",
      state:{
        app:"gestor-alimentacion",
        state:{ ingredients:[], familyMembers:[], nutritionProfiles:[], settings:{} }
      }
    }
  }), { status:200, headers:{ "Content-Type":"application/json" } });
};
const comparison = await previewCloudDifferences();
assert.equal(comparison.remoteUpdatedAt, "2026-06-19T19:00:00.000000Z");
assert.equal(comparison.knownUpdatedAt, beforePreview.updatedAt);
assert.equal(comparison.pendingLocalChanges, true);
assert.equal(getCloudSyncStatus().updatedAt, beforePreview.updatedAt);
assert.equal(getCloudSyncStatus().pendingLocalChanges, true);
assert.match(comparison.summary, /no se ha sustituido ningún dato/i);

// The destructive recovery workflow always creates a local JSON copy
// and asks for confirmation; cancellation keeps unsynced changes.
let downloadWasRequested = false;
globalThis.URL.createObjectURL = () => "blob:local-backup";
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement: tag => {
    assert.equal(tag, "a");
    return { click:() => { downloadWasRequested = true; } };
  }
};
globalThis.confirm = () => false;
const cancelled = await adoptRemoteWithBackup();
assert.equal(cancelled.applied, false);
assert.equal(downloadWasRequested, true);
assert.equal(getCloudSyncStatus().pendingLocalChanges, true);

console.log("cloud-sync.test.js OK");
