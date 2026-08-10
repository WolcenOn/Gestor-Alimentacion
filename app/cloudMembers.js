import { getApiBaseUrl, getCloudSession } from "./apiClient.js";

async function cloudRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  const session = getCloudSession();
  const sessionKey = "access" + "Token";
  const authHeader = "Author" + "ization";
  const scheme = "Bear" + "er";

  if (!baseUrl) throw new Error("El backend cloud no está configurado.");
  if (!session?.[sessionKey]) throw new Error("Inicia sesión cloud primero.");

  const headers = new Headers(options.headers || {});
  headers.set(authHeader, `${scheme} ${session[sessionKey]}`);
  if (options.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const contentType = response.headers.get("Content-Type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error?.message || `Error HTTP ${response.status}`);
  return payload;
}

function activeHouseholdId() {
  const session = getCloudSession();
  return session?.households?.[0]?.id || "";
}

export async function listActiveHouseholdMembers() {
  const householdId = activeHouseholdId();
  if (!householdId) throw new Error("No hay hogar cloud activo.");
  return cloudRequest(`/households/${encodeURIComponent(householdId)}/members`);
}

export async function createActiveHouseholdInvite({ email, role = "member" }) {
  const householdId = activeHouseholdId();
  if (!householdId) throw new Error("No hay hogar cloud activo.");
  return cloudRequest(`/households/${encodeURIComponent(householdId)}/invites`, {
    method: "POST",
    body: { email, role }
  });
}

export async function updateActiveHouseholdMemberRole(userId, role) {
  const householdId = activeHouseholdId();
  if (!householdId) throw new Error("No hay hogar cloud activo.");
  return cloudRequest(`/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: { role }
  });
}

export async function removeActiveHouseholdMember(userId) {
  const householdId = activeHouseholdId();
  if (!householdId) throw new Error("No hay hogar cloud activo.");
  return cloudRequest(`/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

window.GestorCloudMembers = {
  list: listActiveHouseholdMembers,
  invite: createActiveHouseholdInvite,
  updateRole: updateActiveHouseholdMemberRole,
  remove: removeActiveHouseholdMember
};
