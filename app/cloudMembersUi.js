function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const ROLE_INFO = {
  owner: {
    label: "Propietario",
    help: "Control total del hogar. Debe existir al menos un propietario."
  },
  admin: {
    label: "Administrador",
    help: "Puede gestionar miembros, invitaciones y datos compartidos."
  },
  member: {
    label: "Puede editar",
    help: "Puede usar la app y sincronizar cambios del hogar."
  },
  viewer: {
    label: "Solo lectura",
    help: "Puede consultar los datos compartidos sin modificarlos."
  }
};

let loadingPanel = null;

function currentUserId() {
  return window.GestorCloudAPI?.getCloudSession?.()?.user?.id || "";
}

function showMessage(message, type = "success") {
  const alerts = document.getElementById("alerts");
  if (!alerts) return;
  const box = document.createElement("div");
  box.className = `alert ${type === "error" ? "error" : ""}`;
  box.textContent = message;
  alerts.prepend(box);
  window.setTimeout(() => box.remove(), 5500);
}

function roleOptions(selectedRole) {
  return Object.entries(ROLE_INFO).map(([value, info]) => `
    <option value="${value}" ${value === selectedRole ? "selected" : ""}>${escapeHtml(info.label)}</option>
  `).join("");
}

function memberCard(member, ownUserId) {
  const own = member.userId === ownUserId;
  const role = ROLE_INFO[member.role] || { label: member.role || "Sin rol", help: "Permiso del hogar." };
  const display = member.displayName || member.email || "Miembro";
  return `
    <article class="ux-cloud-member" data-cloud-member-id="${escapeHtml(member.userId)}">
      <div class="ux-cloud-member-main">
        <div class="ux-cloud-member-avatar" aria-hidden="true">${escapeHtml(display.slice(0, 1).toUpperCase())}</div>
        <div>
          <div class="ux-cloud-member-name-row">
            <strong>${escapeHtml(display)}</strong>
            ${own ? '<span class="mini-badge">Tú</span>' : ""}
          </div>
          <p class="qty-line">${escapeHtml(member.email || "")}</p>
          <p class="ux-role-current"><strong>${escapeHtml(role.label)}</strong> · ${escapeHtml(role.help)}</p>
        </div>
      </div>
      <div class="ux-cloud-member-controls">
        <label>
          Permiso
          <select data-cloud-role-select>${roleOptions(member.role)}</select>
        </label>
        <button type="button" class="secondary" data-cloud-save-role>Guardar rol</button>
        ${own ? "" : '<button type="button" class="ghost ux-remove-member" data-cloud-remove-member>Quitar</button>'}
      </div>
    </article>
  `;
}

function roleTips() {
  return `
    <details class="ux-role-tips">
      <summary>¿Qué permiso debería elegir?</summary>
      <div class="ux-role-tip-grid">
        ${Object.entries(ROLE_INFO).map(([role, info]) => `
          <div class="ux-role-tip" data-role="${role}">
            <strong>${escapeHtml(info.label)}</strong>
            <span>${escapeHtml(info.help)}</span>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function findMembersPanel() {
  const cloudCard = [...document.querySelectorAll("article.card")]
    .find(card => ["Cuenta y sincronización", "Nube y sincronización"].includes(card.querySelector("h3")?.textContent.trim()));
  if (!cloudCard) return null;
  return [...cloudCard.querySelectorAll(".stack-form")]
    .find(section => section.querySelector("h4")?.textContent.trim() === "Miembros y permisos");
}

async function loadMembers(panel) {
  if (!panel || panel.dataset.cloudMembersUi === "ready" || loadingPanel === panel) return;
  if (!window.GestorCloudAPI?.getCloudSession?.()) return;
  if (!window.GestorCloudMembers?.list) return;

  loadingPanel = panel;
  panel.dataset.cloudMembersUi = "loading";
  panel.innerHTML = `
    <div class="ux-members-heading">
      <div>
        <h4>Miembros y permisos</h4>
        <p class="muted">Las personas del hogar aparecen automáticamente. Elige qué puede hacer cada una.</p>
      </div>
      <span class="badge">Cargando…</span>
    </div>
    <div class="ux-members-loading">Cargando miembros del hogar…</div>
  `;

  try {
    const payload = await window.GestorCloudMembers.list();
    const members = Array.isArray(payload?.members) ? payload.members : [];
    panel.dataset.cloudMembersUi = "ready";
    panel.innerHTML = `
      <div class="ux-members-heading">
        <div>
          <h4>Miembros y permisos</h4>
          <p class="muted">Las personas del hogar aparecen automáticamente. Cambia un permiso solo cuando necesites limitar o ampliar el acceso.</p>
        </div>
        <span class="badge">${members.length} ${members.length === 1 ? "miembro" : "miembros"}</span>
      </div>
      ${roleTips()}
      <div class="ux-cloud-members-list">
        ${members.length ? members.map(member => memberCard(member, currentUserId())).join("") : '<p class="muted">Todavía no hay otros miembros en este hogar.</p>'}
      </div>
    `;
  } catch (error) {
    console.error("No se pudieron cargar los miembros", error);
    panel.dataset.cloudMembersUi = "error";
    panel.innerHTML = `
      <div class="ux-members-heading">
        <div><h4>Miembros y permisos</h4><p class="muted">No hemos podido obtener la lista del hogar.</p></div>
      </div>
      <div class="alert error">${escapeHtml(error?.message || "No se pudieron cargar los miembros.")}</div>
      <button type="button" class="secondary" data-cloud-retry-members>Reintentar</button>
    `;
  } finally {
    loadingPanel = null;
  }
}

async function saveMemberRole(card) {
  const userId = card?.dataset.cloudMemberId;
  const select = card?.querySelector("[data-cloud-role-select]");
  const button = card?.querySelector("[data-cloud-save-role]");
  if (!userId || !select || !button) return;
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = "Guardando…";
  try {
    await window.GestorCloudMembers.updateRole(userId, select.value);
    showMessage("Permiso actualizado.");
    const panel = card.closest(".stack-form");
    if (panel) {
      delete panel.dataset.cloudMembersUi;
      await loadMembers(panel);
    }
  } catch (error) {
    console.error(error);
    showMessage(error?.message || "No se pudo cambiar el permiso.", "error");
    button.disabled = false;
    button.textContent = previous;
  }
}

async function removeMember(card) {
  const userId = card?.dataset.cloudMemberId;
  if (!userId) return;
  const name = card.querySelector("strong")?.textContent || "esta persona";
  if (!window.confirm(`¿Quitar a ${name} de este hogar?`)) return;
  try {
    await window.GestorCloudMembers.remove(userId);
    showMessage("Miembro eliminado del hogar.");
    const panel = card.closest(".stack-form");
    if (panel) {
      delete panel.dataset.cloudMembersUi;
      await loadMembers(panel);
    }
  } catch (error) {
    console.error(error);
    showMessage(error?.message || "No se pudo quitar el miembro.", "error");
  }
}

function enhanceMembers() {
  const panel = findMembersPanel();
  if (panel) loadMembers(panel);
}

document.addEventListener("click", event => {
  const save = event.target.closest("[data-cloud-save-role]");
  if (save) {
    event.preventDefault();
    saveMemberRole(save.closest("[data-cloud-member-id]"));
    return;
  }

  const remove = event.target.closest("[data-cloud-remove-member]");
  if (remove) {
    event.preventDefault();
    removeMember(remove.closest("[data-cloud-member-id]"));
    return;
  }

  const retry = event.target.closest("[data-cloud-retry-members]");
  if (retry) {
    event.preventDefault();
    const panel = retry.closest(".stack-form");
    if (panel) {
      delete panel.dataset.cloudMembersUi;
      loadMembers(panel);
    }
  }
});

const observer = new MutationObserver(() => window.requestAnimationFrame(enhanceMembers));
const viewRoot = document.getElementById("viewRoot");
if (viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
window.addEventListener("load", enhanceMembers);
enhanceMembers();
