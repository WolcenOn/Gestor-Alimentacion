const SESSION_KEY = "gestorMenuSemanal.cloudSession.v1";

function readSession() {
  try {
    return window.GestorCloudAPI?.getCloudSession?.() || JSON.parse(localStorage.getItem(SESSION_KEY) || "null") || null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) return;
  window.GestorCloudAPI?.setCloudSession?.(session);
  window.dispatchEvent(new CustomEvent("gestor:cloud-session", { detail: session }));
}

function households(session = readSession()) {
  return Array.isArray(session?.households) ? session.households : [];
}

function activeHousehold(session = readSession()) {
  const list = households(session);
  const activeId = session?.activeHouseholdId || list[0]?.id || "";
  return list.find(household => household.id === activeId) || list[0] || null;
}

function setActiveHousehold(householdId) {
  const session = readSession();
  const list = households(session);
  if (!session || !list.some(household => household.id === householdId)) return null;
  const next = { ...session, activeHouseholdId: householdId };
  writeSession(next);
  window.GestorCloudSync?.disableAutoSync?.();
  window.setTimeout(() => {
    window.GestorCloudSync?.startAutoSync?.().catch(error => console.warn("No se pudo reiniciar autosync", error));
  }, 150);
  return activeHousehold(next);
}

function autoSelectLikelySharedHousehold() {
  const session = readSession();
  const list = households(session);
  if (!session || session.activeHouseholdId || list.length < 2) return;
  const nonOwner = list.find(household => household.role && household.role !== "owner");
  const likelyShared = nonOwner || list[list.length - 1];
  if (likelyShared?.id) writeSession({ ...session, activeHouseholdId: likelyShared.id });
}

function renderPanel() {
  const session = readSession();
  const list = households(session);
  if (!session || !list.length) return "";
  const active = activeHousehold(session);
  return `
    <div class="help-note cloud-household-panel" data-cloud-household-panel>
      <label>Hogar que se sincroniza ahora
        <select data-cloud-household-select>
          ${list.map(household => `<option value="${escapeHtml(household.id)}" ${household.id === active?.id ? "selected" : ""}>${escapeHtml(household.name || "Hogar")} · ${escapeHtml(household.role || "rol")}</option>`).join("")}
        </select>
      </label>
      <p class="small muted">Si un usuario invitado tiene su propio hogar y el hogar compartido, debe estar seleccionado el hogar del owner para ver los mismos datos.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function injectPanel() {
  const card = document.querySelector(".cloud-sync-card");
  if (!card || card.querySelector("[data-cloud-household-panel]")) return;
  const html = renderPanel();
  if (!html) return;
  const facts = card.querySelector(".mini-facts");
  facts?.insertAdjacentHTML("afterend", html);
}

window.GestorCloudHouseholds = {
  list: () => households(),
  active: () => activeHousehold(),
  setActive: setActiveHousehold,
  autoSelect: autoSelectLikelySharedHousehold,
  renderPanel,
  injectPanel
};

document.addEventListener("change", event => {
  const select = event.target.closest("[data-cloud-household-select]");
  if (!select) return;
  const active = setActiveHousehold(select.value);
  if (active) alert(`Hogar activo para sincronizar: ${active.name || "Hogar"}`);
}, true);

window.addEventListener("load", () => {
  autoSelectLikelySharedHousehold();
  window.setTimeout(injectPanel, 1000);
});

window.addEventListener("gestor:cloud-sync-status", () => window.setTimeout(injectPanel, 100));
window.addEventListener("gestor:cloud-session", () => window.setTimeout(injectPanel, 100));

document.addEventListener("click", () => window.setTimeout(injectPanel, 50), true);
