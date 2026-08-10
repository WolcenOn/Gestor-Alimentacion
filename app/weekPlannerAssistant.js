import { getState, updateState } from "./store.js";
import { DAYS, escapeHtml } from "./utils.js";
import { openModal, closeModal, showAlert } from "./render/ui.js";

const ALL_MEMBERS = "__all_members__";
let plannerTray = [];
let plannerCombo = [];
let plannerSettings = {
  mealId: "",
  memberId: ALL_MEMBERS,
  applyMode: "empty",
  days: [...DAYS]
};

ensurePlannerStylesheet();

function ensurePlannerStylesheet() {
  for (const href of ["week-planner-assistant.css", "week-planner-tray.css"]) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }
}

function openWeekPlannerAssistant() {
  const state = getState();
  if (!plannerSettings.mealId) plannerSettings.mealId = state.mealTypes[0]?.id || "";
  openModal(renderPlannerModal(state));
}

function renderPlannerModal(state) {
  const week = state.weeks.find(item => item.id === state.activeWeekId);
  const selectedMealId = plannerSettings.mealId || state.mealTypes[0]?.id || "";
  const selectedMeal = state.mealTypes.find(meal => meal.id === selectedMealId);
  const matchingCount = plannerTray.filter(item => item.mealId === selectedMealId).length;
  return `
    <header>
      <div>
        <p class="eyebrow">Asistente</p>
        <h2>Planificar semana por propuestas</h2>
        <p class="muted">Construye platos o combinaciones, guárdalos en una lista y luego rellena desayuno, comida o cena.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>

    <form data-form="week-planner-assistant" class="week-planner-form">
      <section class="week-planner-grid">
        <div class="planner-section">
          <h3>1. Días que quieres rellenar</h3>
          <div class="planner-chip-grid">
            ${DAYS.map(day => `<label class="planner-check"><input type="checkbox" name="days" value="${escapeHtml(day)}" ${plannerSettings.days.includes(day) ? "checked" : ""}> ${escapeHtml(capitalize(day))}</label>`).join("")}
          </div>
        </div>

        <div class="planner-section">
          <h3>2. Contexto</h3>
          <label>Tipo de comida
            <select name="mealId" required data-planner-setting>
              ${state.mealTypes.map(meal => `<option value="${escapeHtml(meal.id)}" ${meal.id === selectedMealId ? "selected" : ""}>${escapeHtml(meal.name)}</option>`).join("")}
            </select>
          </label>
          <label>Para quién
            <select name="memberId" required data-planner-setting>
              <option value="${ALL_MEMBERS}" ${plannerSettings.memberId === ALL_MEMBERS ? "selected" : ""}>Todos los miembros</option>
              ${state.familyMembers.map(member => `<option value="${escapeHtml(member.id)}" ${plannerSettings.memberId === member.id ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
            </select>
          </label>
          <label>Al rellenar huecos
            <select name="applyMode" data-planner-setting>
              <option value="empty" ${plannerSettings.applyMode === "empty" ? "selected" : ""}>Rellenar solo huecos vacíos</option>
              <option value="replace" ${plannerSettings.applyMode === "replace" ? "selected" : ""}>Sustituir lo que haya</option>
              <option value="append" ${plannerSettings.applyMode === "append" ? "selected" : ""}>Añadir a lo que ya haya</option>
            </select>
          </label>
        </div>
      </section>

      <section class="planner-section">
        <h3>3. Buscar platos</h3>
        <div class="form-grid">
          <label>Buscar receta, etiqueta o ingrediente<input name="includeText" data-planner-filter placeholder="Ej. salmón, verduras, rápido, desayuno"></label>
          <label>Excluir ingrediente o palabra<input name="excludeText" data-planner-filter placeholder="Ej. gluten, leche, frutos secos"></label>
        </div>
        <p class="small muted" data-planner-filter-count>${state.dishes.length} receta(s) visibles.</p>
      </section>

      <section class="planner-section planner-dish-picker-section">
        <div class="section-title-row">
          <div>
            <h3>4. Construye una propuesta</h3>
            <p class="muted">Pulsa “Sumar” en cada plato para crear una combinación. También puedes marcar varios y sumarlos juntos.</p>
          </div>
          <button type="button" data-action="add-selected-to-planner-combo">Sumar selección</button>
        </div>
        ${state.dishes.length ? `<div class="planner-dish-list">${state.dishes.map(dish => renderDishChoice(state, dish)).join("")}</div>` : `<p class="muted">Todavía no hay recetas. Importa packs o crea platos antes de usar el asistente.</p>`}
      </section>

      <section class="planner-section planner-combo-section">
        <div class="section-title-row">
          <div>
            <h3>5. Combinación en construcción</h3>
            <p class="muted">Aquí sí se ve la combinación completa antes de guardarla.</p>
          </div>
          <span class="badge ${plannerCombo.length > 1 ? "success" : "warning"}">${plannerCombo.length} plato(s)</span>
        </div>
        ${renderCurrentCombo(state)}
        <div class="actions wrap">
          <button type="button" data-action="save-planner-combo">Guardar propuesta en la lista</button>
          <button type="button" class="secondary" data-action="clear-planner-combo">Limpiar combinación</button>
        </div>
      </section>

      <section class="planner-section planner-tray-section">
        <div class="section-title-row">
          <div>
            <h3>6. Lista de propuestas</h3>
            <p class="muted">Cuando tengas varias propuestas para ${escapeHtml(selectedMeal?.name || "esta comida")}, rellena los huecos.</p>
          </div>
          <span class="badge ${matchingCount >= 5 ? "success" : "warning"}">${matchingCount} para esta comida</span>
        </div>
        ${renderPlannerTray(state)}
        ${matchingCount >= 5 ? `<p class="planner-suggestion success">Ya tienes ${matchingCount} propuestas para ${escapeHtml(selectedMeal?.name || "esta comida")}. Puedes rellenar los huecos de la semana.</p>` : `<p class="planner-suggestion">Añade unas 5 propuestas para cubrir la comida entre semana y luego rellena huecos.</p>`}
        <div class="actions wrap">
          <button type="button" data-action="fill-planner-meal">Rellenar huecos de esta comida</button>
          <button type="button" class="secondary" data-action="clear-planner-tray">Vaciar lista</button>
        </div>
      </section>

      <section class="planner-preview-card">
        <strong>Resumen</strong>
        <p class="muted">Semana: ${escapeHtml(week?.name || "Sin semana activa")}. Las propuestas se aplican en rotación y cada combinación queda junta en el mismo hueco.</p>
      </section>
    </form>
  `;
}

function renderDishChoice(state, dish) {
  const meta = dishSearchText(state, dish);
  return `
    <label class="planner-dish-choice" data-planner-dish-search="${escapeHtml(normalizeSearch(meta))}">
      <input type="checkbox" name="dishIds" value="${escapeHtml(dish.id)}">
      <span>
        <strong>${escapeHtml(dish.name)}</strong>
        <small>${escapeHtml([dish.category, ...(dish.tags || [])].filter(Boolean).join(" · ") || "Sin etiquetas")}</small>
      </span>
      <button type="button" class="secondary" data-action="add-planner-dish" data-dish-id="${escapeHtml(dish.id)}">Sumar</button>
    </label>
  `;
}

function renderCurrentCombo(state) {
  if (!plannerCombo.length) return `<p class="muted">Aún no hay platos en la combinación. Pulsa “Sumar” en salmón, puré, ensalada, etc.</p>`;
  return `
    <div class="planner-tray-list">
      ${plannerCombo.map(dishId => {
        const dish = state.dishes.find(item => item.id === dishId);
        return `
          <article class="planner-tray-item">
            <div><strong>${escapeHtml(dish?.name || "Plato eliminado")}</strong></div>
            <button type="button" class="ghost icon-button" data-action="remove-planner-dish-from-combo" data-dish-id="${escapeHtml(dishId)}" aria-label="Quitar plato de la combinación">×</button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderPlannerTray(state) {
  if (!plannerTray.length) return `<p class="muted">Todavía no has añadido propuestas. Crea una combinación y guárdala en la lista.</p>`;
  return `
    <div class="planner-tray-list">
      ${plannerTray.map((item, index) => renderPlannerTrayItem(state, item, index)).join("")}
    </div>
  `;
}

function renderPlannerTrayItem(state, item, index) {
  const meal = state.mealTypes.find(meal => meal.id === item.mealId);
  const member = item.memberId === ALL_MEMBERS ? null : state.familyMembers.find(member => member.id === item.memberId);
  const dishes = item.dishIds.map(id => state.dishes.find(dish => dish.id === id)?.name || "Plato eliminado");
  return `
    <article class="planner-tray-item">
      <div>
        <strong>${index + 1}. ${escapeHtml(dishes.join(" + "))}</strong>
        <p class="qty-line">${escapeHtml(meal?.name || "Comida")} · ${member ? escapeHtml(member.name) : "Todos"}</p>
      </div>
      <button type="button" class="ghost icon-button" data-action="remove-planner-menu" data-planner-menu-id="${escapeHtml(item.id)}" aria-label="Quitar propuesta">×</button>
    </article>
  `;
}

function addDishToCurrentCombo(dishId) {
  if (!dishId) return;
  plannerCombo = dedupeDishIds([...plannerCombo, dishId]);
  openModal(renderPlannerModal(getState()));
}

function addSelectedToCurrentCombo(form) {
  const selected = selectedVisibleDishIds(form);
  if (!selected.length) throw new Error("Marca al menos un plato o usa el botón Sumar de cada tarjeta.");
  plannerCombo = dedupeDishIds([...plannerCombo, ...selected]);
  openModal(renderPlannerModal(getState()));
}

function saveCurrentCombo(form) {
  syncPlannerSettings(form);
  const fallbackSelected = selectedVisibleDishIds(form);
  const dishIds = dedupeDishIds(plannerCombo.length ? plannerCombo : fallbackSelected);
  if (!dishIds.length) throw new Error("Añade al menos un plato a la combinación antes de guardarla.");
  plannerTray.push({
    id: `menu_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    mealId: plannerSettings.mealId,
    memberId: plannerSettings.memberId,
    dishIds
  });
  plannerCombo = [];
  openModal(renderPlannerModal(getState()));
  const count = plannerTray.filter(item => item.mealId === plannerSettings.mealId).length;
  showAlert(count >= 5 ? `Ya tienes ${count} propuestas para esta comida. Puedes rellenar huecos.` : "Propuesta guardada en la lista.");
}

function fillPlannerMeal(form) {
  syncPlannerSettings(form);
  const state = getState();
  const days = plannerSettings.days;
  const mealId = plannerSettings.mealId;
  const applyMode = plannerSettings.applyMode;
  if (!days.length) throw new Error("Selecciona al menos un día.");
  if (!mealId) throw new Error("Selecciona una comida.");
  const matchingMenus = plannerTray.filter(item => item.mealId === mealId);
  if (!matchingMenus.length) throw new Error("Añade primero propuestas para esta comida.");

  const requestedMembers = plannerSettings.memberId === ALL_MEMBERS
    ? state.familyMembers.map(member => member.id)
    : [plannerSettings.memberId];

  let applied = 0;
  updateState(draft => {
    const week = draft.weeks.find(item => item.id === draft.activeWeekId);
    if (!week) throw new Error("No hay semana activa.");
    week.plan ||= {};
    const cursors = new Map();

    for (const targetMemberId of requestedMembers) {
      const menusForMember = matchingMenus.filter(item => item.memberId === ALL_MEMBERS || item.memberId === targetMemberId);
      if (!menusForMember.length) continue;
      for (const day of days) {
        const slot = `${day}__${mealId}__${targetMemberId}`;
        const current = week.plan[slot] || [];
        const hasPlanned = current.length > 0;
        if (applyMode === "empty" && hasPlanned) continue;
        const cursor = cursors.get(targetMemberId) || 0;
        const proposal = menusForMember[cursor % menusForMember.length];
        week.plan[slot] = applyMode === "append"
          ? dedupeDishIds([...current, ...proposal.dishIds])
          : [...proposal.dishIds];
        cursors.set(targetMemberId, cursor + 1);
        applied += 1;
      }
    }
  }, "week-planner-assistant");

  closeModal();
  showAlert(applied ? `Huecos rellenados con ${matchingMenus.length} propuesta(s). Aplicado en ${applied} hueco(s).` : "No había huecos aplicables para esos días y persona.");
}

function selectedVisibleDishIds(form) {
  return [...form.querySelectorAll('.planner-dish-choice:not([hidden]) input[name="dishIds"]:checked')].map(input => input.value);
}

function syncPlannerSettings(form) {
  plannerSettings = {
    mealId: String(form.elements.mealId?.value || plannerSettings.mealId || ""),
    memberId: String(form.elements.memberId?.value || plannerSettings.memberId || ALL_MEMBERS),
    applyMode: String(form.elements.applyMode?.value || plannerSettings.applyMode || "empty"),
    days: new FormData(form).getAll("days").map(String)
  };
}

function removePlannerMenu(menuId) {
  plannerTray = plannerTray.filter(item => item.id !== menuId);
  openModal(renderPlannerModal(getState()));
}

function clearPlannerTray() {
  plannerTray = [];
  openModal(renderPlannerModal(getState()));
  showAlert("Lista de propuestas vaciada.");
}

function removeDishFromCombo(dishId) {
  plannerCombo = plannerCombo.filter(item => item !== dishId);
  openModal(renderPlannerModal(getState()));
}

function clearPlannerCombo() {
  plannerCombo = [];
  openModal(renderPlannerModal(getState()));
}

function dedupeDishIds(dishIds) {
  return [...new Set(dishIds.filter(Boolean))];
}

function updatePlannerFilters(form) {
  const includeText = normalizeSearch(form.elements.includeText?.value);
  const excludeText = normalizeSearch(form.elements.excludeText?.value);
  let visible = 0;
  form.querySelectorAll("[data-planner-dish-search]").forEach(choice => {
    const text = choice.dataset.plannerDishSearch || "";
    const show = (!includeText || text.includes(includeText)) && (!excludeText || !text.includes(excludeText));
    choice.hidden = !show;
    const checkbox = choice.querySelector('input[type="checkbox"]');
    if (!show && checkbox) checkbox.checked = false;
    if (show) visible += 1;
  });
  const counter = form.querySelector("[data-planner-filter-count]");
  if (counter) counter.textContent = `${visible} receta(s) visibles.`;
}

function dishSearchText(state, dish) {
  const ingredientNames = (dish.recipe || [])
    .map(line => state.ingredients.find(ingredient => ingredient.id === line.ingredientId)?.name || "")
    .filter(Boolean);
  return [
    dish.name,
    dish.category,
    ...(dish.tags || []),
    dish.notes,
    dish.prepTime,
    ...(dish.instructions || []),
    ...ingredientNames
  ].filter(Boolean).join(" ");
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

document.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "open-week-planner-assistant") {
    openWeekPlannerAssistant();
    return;
  }

  const form = actionButton.closest('form[data-form="week-planner-assistant"]');
  if (!form) return;
  try {
    if (action === "add-planner-dish") addDishToCurrentCombo(actionButton.dataset.dishId);
    if (action === "add-selected-to-planner-combo") addSelectedToCurrentCombo(form);
    if (action === "save-planner-combo" || action === "add-planner-menu") saveCurrentCombo(form);
    if (action === "clear-planner-combo") clearPlannerCombo();
    if (action === "remove-planner-dish-from-combo") removeDishFromCombo(actionButton.dataset.dishId);
    if (action === "fill-planner-meal") fillPlannerMeal(form);
    if (action === "remove-planner-menu") removePlannerMenu(actionButton.dataset.plannerMenuId);
    if (action === "clear-planner-tray") clearPlannerTray();
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo actualizar el asistente.", "error");
  }
});

document.addEventListener("change", event => {
  const form = event.target.closest('form[data-form="week-planner-assistant"]');
  if (!form || !event.target.matches("[data-planner-setting], input[name='days']")) return;
  syncPlannerSettings(form);
});

document.addEventListener("input", event => {
  if (!event.target.matches("[data-planner-filter]")) return;
  const form = event.target.closest('form[data-form="week-planner-assistant"]');
  if (form) updatePlannerFilters(form);
});

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="week-planner-assistant"]');
  if (!form) return;
  event.preventDefault();
  try {
    fillPlannerMeal(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo aplicar la planificación.", "error");
  }
});
