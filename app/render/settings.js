import { escapeHtml } from "../utils.js";
import { getApiBaseUrl, getCloudSession, isCloudConfigured } from "../apiClient.js";
import { getCloudSyncStatus } from "../cloudSync.js";

function activeHouseholdFromSession(session, syncStatus) {
  const households = Array.isArray(session?.households) ? session.households : [];
  const activeId = session?.activeHouseholdId || syncStatus.householdId || households[0]?.id || "";
  return households.find(household => household.id === activeId) || households[0] || null;
}

function renderCloudSettings() {
  const configured = isCloudConfigured();
  const apiBaseUrl = getApiBaseUrl();
  const session = getCloudSession();
  const syncStatus = getCloudSyncStatus();
  const activeHousehold = activeHouseholdFromSession(session, syncStatus);
  const userEmail = session?.user?.email || "";
  const householdName = activeHousehold?.name || syncStatus.householdName || "";
  const householdRole = activeHousehold?.role || syncStatus.role || "";
  const statusLabel = syncStatus.mode === "synced" ? "Sincronizado" : syncStatus.mode === "syncing" ? "Sincronizando" : syncStatus.mode === "error" ? "Error" : syncStatus.mode === "pending" ? "Pendiente" : syncStatus.mode === "ready" ? "Preparado" : "Local";
  const pendingInfo = syncStatus.pendingLocalChanges ? `Cambios locales pendientes${syncStatus.pendingSince ? ` desde ${new Date(syncStatus.pendingSince).toLocaleString()}` : ""}` : "Sin cambios pendientes";

  const loginSubmit = "event.preventDefault();window.GestorCloudAPI.loginCloudAccount({email:this.elements.email.value,password:this.elements.password.value}).then(()=>{alert('Sesión cloud iniciada.');location.reload();}).catch(error=>alert(error.message));";
  const registerSubmit = "event.preventDefault();window.GestorCloudAPI.registerCloudAccount({email:this.elements.email.value,password:this.elements.password.value,displayName:this.elements.displayName.value,householdName:this.elements.householdName.value||'Mi hogar'}).then(()=>{alert('Cuenta cloud creada.');location.reload();}).catch(error=>alert(error.message));";
  const inviteSubmit = "event.preventDefault();window.GestorCloudMembers.invite({email:this.elements.email.value,role:this.elements.role.value}).then(({invite})=>{const link=location.origin+location.pathname+'?invite='+invite.token;this.querySelector('[data-invite-output]').value=link;alert('Invitación creada. Copia el enlace y envíalo a la otra cuenta.');}).catch(error=>alert(error.message));";
  const loadMembers = "window.GestorCloudMembers.list().then(({members})=>{document.getElementById('cloudMembersOutput').textContent=members.map(m=>`${m.email} · ${m.role} · ${m.userId}`).join('\\n')||'Sin miembros';}).catch(error=>alert(error.message));";
  const updateRole = "const id=document.getElementById('cloudMemberUserId').value.trim();const role=document.getElementById('cloudMemberRole').value;if(!id){alert('Pega el userId del miembro.');return;}window.GestorCloudMembers.updateRole(id,role).then(()=>{alert('Rol actualizado.');}).catch(error=>alert(error.message));";
  const removeMember = "const id=document.getElementById('cloudMemberUserId').value.trim();if(!id){alert('Pega el userId del miembro.');return;}if(!confirm('¿Quitar esta cuenta del hogar?'))return;window.GestorCloudMembers.remove(id).then(()=>{alert('Miembro eliminado.');}).catch(error=>alert(error.message));";

  return `
    <article class="card cloud-sync-card">
      <div class="section-title-row">
        <div>
          <h3>Nube y sincronización</h3>
          <p class="muted">Guarda tus datos en Railway/PostgreSQL y compártelos entre dispositivos. El modo local sigue funcionando si la nube falla.</p>
        </div>
        <span class="badge ${syncStatus.mode === "error" || syncStatus.mode === "pending" ? "warning" : ""}">${escapeHtml(statusLabel)}</span>
      </div>

      <div class="mini-facts">
        <span>API: ${configured ? "configurada" : "sin configurar"}</span>
        <span>Sesión: ${session ? escapeHtml(userEmail) : "no iniciada"}</span>
        <span>Hogar activo: ${householdName ? `${escapeHtml(householdName)}${householdRole ? ` · ${escapeHtml(householdRole)}` : ""}` : "sin seleccionar"}</span>
        <span>${escapeHtml(pendingInfo)}</span>
      </div>

      ${configured ? `<p class="qty-line">Backend: <code>${escapeHtml(apiBaseUrl)}</code></p>` : `<p class="alert">Configura <code>app/config.js</code> para activar la nube.</p>`}
      ${syncStatus.householdId ? `<p class="small muted">ID hogar sync: <code>${escapeHtml(syncStatus.householdId)}</code></p>` : ""}
      ${syncStatus.updatedAt ? `<p class="qty-line">Última actualización en nube: ${escapeHtml(new Date(syncStatus.updatedAt).toLocaleString())}</p>` : ""}
      ${syncStatus.lastSyncAt ? `<p class="qty-line">Última sincronización local: ${escapeHtml(new Date(syncStatus.lastSyncAt).toLocaleString())}</p>` : ""}
      ${syncStatus.lastAttemptAt ? `<p class="qty-line">Último intento: ${escapeHtml(new Date(syncStatus.lastAttemptAt).toLocaleString())}${syncStatus.retryCount ? ` · reintentos: ${Number(syncStatus.retryCount)}` : ""}</p>` : ""}
      ${syncStatus.lastError ? `<p class="alert">${escapeHtml(syncStatus.lastError)}</p>` : ""}

      ${session ? `
        <div class="actions wrap">
          <button type="button" onclick="window.GestorCloudSync.push().then(()=>alert('Datos subidos a la nube.')).catch(error=>alert(error.message))">Subir datos locales a la nube</button>
          <button type="button" class="secondary" onclick="window.GestorCloudSync.pull({apply:true}).then(()=>{alert('Datos descargados desde la nube.');location.reload();}).catch(error=>alert(error.message))">Descargar datos de la nube</button>
          <button type="button" class="secondary" onclick="window.GestorCloudSync.enableAutoSync();window.GestorCloudSync.push().then(()=>alert('Autosync activado.')).catch(error=>alert(error.message))">Activar autosync</button>
          <button type="button" class="secondary" onclick="window.GestorCloudAPI.clearCloudSession();alert('Sesión cloud cerrada.');location.reload();">Cerrar sesión cloud</button>
        </div>

        <div class="grid cols-2 settings-grid">
          <form class="stack-form" onsubmit="${escapeHtml(inviteSubmit)}">
            <h4>Invitar a otra cuenta</h4>
            <label>Email invitado
              <input name="email" type="email" autocomplete="email" placeholder="persona@ejemplo.com">
            </label>
            <label>Permiso
              <select name="role">
                <option value="viewer">Viewer · solo consultar</option>
                <option value="member" selected>Member · consultar y sincronizar</option>
                <option value="admin">Admin · invitar y editar hogar</option>
              </select>
            </label>
            <button type="submit">Crear invitación</button>
            <label>Enlace de invitación
              <textarea data-invite-output rows="3" readonly placeholder="Aquí aparecerá el enlace para enviar"></textarea>
            </label>
          </form>

          <div class="stack-form">
            <h4>Miembros y permisos</h4>
            <button type="button" class="secondary" onclick="${escapeHtml(loadMembers)}">Cargar miembros</button>
            <pre id="cloudMembersOutput" class="help-note" style="white-space:pre-wrap;max-height:12rem;overflow:auto;">Pulsa “Cargar miembros”.</pre>
            <label>User ID del miembro
              <input id="cloudMemberUserId" autocomplete="off" placeholder="Pega aquí el userId">
            </label>
            <label>Nuevo rol
              <select id="cloudMemberRole">
                <option value="viewer">viewer</option>
                <option value="member" selected>member</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            </label>
            <div class="actions wrap">
              <button type="button" onclick="${escapeHtml(updateRole)}">Cambiar rol</button>
              <button type="button" class="secondary" onclick="${escapeHtml(removeMember)}">Quitar del hogar</button>
            </div>
          </div>
        </div>
      ` : `
        <div class="grid cols-2 settings-grid">
          <form data-form="cloud-login" class="stack-form" onsubmit="${escapeHtml(loginSubmit)}">
            <h4>Iniciar sesión</h4>
            <label>Email
              <input name="email" type="email" autocomplete="email" required>
            </label>
            <label>Contraseña
              <input name="password" type="password" autocomplete="current-password" required minlength="8">
            </label>
            <button ${configured ? "" : "disabled"}>Entrar</button>
          </form>

          <form data-form="cloud-register" class="stack-form" onsubmit="${escapeHtml(registerSubmit)}">
            <h4>Crear cuenta</h4>
            <label>Email
              <input name="email" type="email" autocomplete="email" required>
            </label>
            <label>Nombre visible
              <input name="displayName" autocomplete="name" placeholder="Ej. Virginia" maxlength="80">
            </label>
            <label>Nombre del hogar
              <input name="householdName" placeholder="Ej. Casa" maxlength="80">
            </label>
            <label>Contraseña
              <input name="password" type="password" autocomplete="new-password" required minlength="8">
            </label>
            <button ${configured ? "" : "disabled"}>Crear cuenta y hogar</button>
          </form>
        </div>
      `}

      <div class="help-note">
        <p><strong>Recomendación:</strong> comprueba arriba que “Hogar activo” es el hogar compartido. Después usa “Subir datos locales a la nube” en el owner y “Descargar datos de la nube” en el admin.</p>
        <p class="muted">Roles: <strong>owner</strong> es la cuenta principal/propietaria, <strong>admin</strong> puede invitar y editar hogar, <strong>member</strong> puede sincronizar, <strong>viewer</strong> queda preparado para modo solo lectura.</p>
      </div>
    </article>
  `;
}

function renderPrivacySettings(state) {
  const session = getCloudSession();
  const syncStatus = getCloudSyncStatus();
  const cloudMode = session ? "Cloud activo" : "Solo local";
  const lastSync = syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : "sin sincronización";
  const totals = [
    `${state.ingredients.length} ingredientes`,
    `${state.dishes.length} platos`,
    `${state.weeks.length} semanas`,
    `${state.nutritionProfiles.length} perfiles nutricionales`,
    `${state.historySnapshots.length} snapshots`
  ];

  return `
    <article class="card privacy-card">
      <div class="section-title-row">
        <div>
          <h3>Privacidad y datos</h3>
          <p class="muted">Controla qué se guarda en este navegador y qué podría sincronizarse con la nube cuando actives una cuenta cloud.</p>
        </div>
        <span class="badge ${session ? "success" : ""}">${escapeHtml(cloudMode)}</span>
      </div>
      <div class="mini-facts">
        <span>Estado: ${escapeHtml(cloudMode)}</span>
        <span>Última sync: ${escapeHtml(lastSync)}</span>
        <span>Datos: ${escapeHtml(totals.join(" · "))}</span>
      </div>
      <div class="help-note">
        <p><strong>Modo local:</strong> los datos viven en <code>localStorage</code> de este navegador. Exporta JSON antes de borrar caché, cambiar de dispositivo o hacer pruebas destructivas.</p>
        <p><strong>Modo cloud:</strong> al iniciar sesión y sincronizar, el estado del hogar se guarda en el backend configurado. El borrado local no elimina datos ya subidos a la nube.</p>
        <p class="muted">La app puede contener datos sensibles si registras glucosa, metabolismo o información de salud. No compartas exportaciones JSON sin revisarlas.</p>
      </div>
      <div class="actions wrap">
        <button type="button" data-action="export-data">Exportar mis datos JSON</button>
        <button type="button" class="secondary" data-action="reset-local-data">Borrar datos locales de este navegador</button>
      </div>
    </article>
  `;
}

export function renderSettings(state) {
  const ingredientsWithNutrition = new Set(state.nutritionProfiles.map(profile => profile.ingredientId));
  const pendingNutrition = state.ingredients.filter(ingredient => !ingredientsWithNutrition.has(ingredient.id)).length;
  const offLinked = state.ingredients.filter(ingredient => (ingredient.products || []).some(product => product.source === "openfoodfacts" || product.barcode)).length;

  return `
    <div class="card-header settings-header">
      <div>
        <p class="eyebrow">Configuración</p>
        <h2>Familia, comidas y datos externos</h2>
        <p class="muted">Personaliza quién come en casa, qué comidas se planifican y cómo se consultan bases de datos nutricionales.</p>
      </div>
    </div>

    ${renderCloudSettings()}
    ${renderPrivacySettings(state)}

    <div class="grid cols-2 settings-grid">
      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Miembros de la familia</h3>
            <p class="muted">Añade personas o grupos: Virginia, Niños, Adultos, Todos...</p>
          </div>
          <span class="badge">${state.familyMembers.length}</span>
        </div>
        <form data-form="family-member" class="inline-form">
          <label>Nombre del miembro o grupo
            <input name="name" autocomplete="off" placeholder="Ej. Niños" required maxlength="40">
          </label>
          <button>Añadir</button>
        </form>
        <div class="list compact-list">
          ${state.familyMembers.map(member => `
            <div class="item member-row">
              <div>
                <strong>${escapeHtml(member.name)}</strong>
                <p class="qty-line">Se podrá planificar de forma independiente.</p>
              </div>
              <button class="secondary ${state.familyMembers.length <= 1 ? "disabled" : ""}" data-action="delete-family-member" data-member-id="${escapeHtml(member.id)}" ${state.familyMembers.length <= 1 ? "disabled" : ""}>Quitar</button>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Comidas registrables</h3>
            <p class="muted">Crea las comidas reales de vuestra rutina: desayuno, almuerzo, cena, batch cooking...</p>
          </div>
          <span class="badge">${state.mealTypes.length}</span>
        </div>
        <form data-form="meal-type" class="inline-form">
          <label>Nombre de la comida
            <input name="name" autocomplete="off" placeholder="Ej. Almuerzo colegio" required maxlength="40">
          </label>
          <button>Añadir</button>
        </form>
        <div class="list compact-list">
          ${state.mealTypes.map(meal => `
            <div class="item member-row">
              <div>
                <strong>${escapeHtml(meal.name)}</strong>
                <p class="qty-line">Aparecerá como bloque planificable en la semana.</p>
              </div>
              <button class="secondary ${state.mealTypes.length <= 1 ? "disabled" : ""}" data-action="delete-meal-type" data-meal-id="${escapeHtml(meal.id)}" ${state.mealTypes.length <= 1 ? "disabled" : ""}>Quitar</button>
            </div>
          `).join("")}
        </div>
      </article>
    </div>

    <div class="grid cols-2 settings-grid">
      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>USDA FoodData Central</h3>
            <p class="muted">Para búsquedas nutricionales. La clave se guarda solo en esta sesión del navegador, no en localStorage ni en el repositorio.</p>
          </div>
          <span class="badge">API</span>
        </div>
        <form data-form="usda-settings" class="inline-form">
          <label>API key USDA
            <input name="usdaApiKey" type="password" autocomplete="off" placeholder="Vacío = usar DEMO_KEY con límites bajos">
          </label>
          <button>Guardar sesión</button>
        </form>
        <div class="help-note">
          <p><strong>Cómo conseguirla:</strong> entra en FoodData Central → Data → Get an API Key. Te enviarán una key de data.gov.</p>
          <p class="muted">La app puede usar <code>DEMO_KEY</code> si no configuras nada, pero USDA indica que tiene límites mucho más bajos que una clave propia.</p>
        </div>
      </article>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Enriquecimiento nutricional por lotes</h3>
            <p class="muted">Completa ingredientes pendientes usando primero productos asociados de Open Food Facts y después USDA para alimentos a granel.</p>
          </div>
          <span class="badge warning">${pendingNutrition} pendientes</span>
        </div>
        <div class="mini-facts">
          <span>Con Open Food Facts/código: ${offLinked}</span>
          <span>Sin nutrición: ${pendingNutrition}</span>
        </div>
        <div class="actions wrap">
          <button type="button" data-action="scan-bulk-nutrition">Buscar nutrición pendiente</button>
          <button type="button" class="secondary" data-action="apply-bulk-nutrition">Aplicar fiables</button>
          <button type="button" class="secondary" data-action="clear-bulk-nutrition-cache">Borrar candidaturas</button>
        </div>
        <div id="nutritionBatchResults" class="nutrition-batch-results"></div>
      </article>
    </div>

    <article class="card">
      <div class="section-title-row"><div><h3>Exportar e importar datos</h3><p class="muted">Copia de seguridad local en JSON.</p></div></div>
      <div class="actions wrap">
        <button data-action="export-data">Exportar JSON</button>
        <label class="button secondary file-button">Importar JSON<input id="importFile" type="file" accept="application/json,.json" hidden></label>
      </div>
    </article>
  `;
}
