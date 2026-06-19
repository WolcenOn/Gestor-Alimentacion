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

localStorage.setItem("gestorMenuSemanal.cloudSession.v1", JSON.stringify(session));

const { updateState } = await import("../store.js");
const { ApiError } = await import("../apiClient.js");
const { enableCloudAutoSync, getCloudSyncStatus, pullCloudState, pushCloudState } = await import("../cloudSync.js");

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
  return new Response(JSON.stringify({ sync: { updatedAt: "2026-06-19T16:00:00.000Z" } }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

await pushCloudState();
status = getCloudSyncStatus();
assert.equal(fetchCalls, 1);
assert.equal(status.pendingLocalChanges, false);
assert.equal(status.mode, "synced");
assert.equal(status.retryCount, 0);
assert.equal(status.updatedAt, "2026-06-19T16:00:00.000Z");

console.log("cloud-sync.test.js OK");
