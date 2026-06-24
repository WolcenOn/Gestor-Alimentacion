import { getState, updateState } from "./store.js";
import { DAYS, escapeHtml } from "./utils.js";
import { openModal, closeModal, showAlert } from "./render/ui.js";

const ALL_MEMBERS = "__all_members__";

function openWeekPlannerAssistant() {
  openModal(renderPlannerModal(getState()));
}

function renderPlannerModal(state) {
  const week = state.weeks.find(item => item.id === state.activeWeekId);
  const selectedMeal = state.mealTypes[0]?.id || "";
  return `
    <header>
      <div>
        <p class="eyebrow">Asistente</p>
        <h2>Planificar semana automáticamente</h2>
        <p class="muted">Elige días, comida, miembros y recetas. El asistente las aplicará en rotación sobre la semana activa.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>

    <form data-form="week-planner-assistant" class="week-planner-form">
      <section class="week-planner-grid">
        <div class="planner-section">
          <h3>1. Días</h3>
          <div class="planner-chip-grid">
            ${DAYS.map(day => `<label class="planner-check"><input type="checkbox" name="days" value="${escapeHtml(day)}" checked> ${escapeHtml(capitalize(day))}</label>`).join("")}
          </div>
        </div>

        <div class="planner-section">
          <h3>2. Comida y miembro</h3>
          <label>Tipo de comida
            <select name="mealId" required>
              ${state.mealTypes.map(meal => `<option value="${escapeHtml(meal.id)}" ${meal.id === selectedMeal ? "selected" : ""}>${escapeHtml(meal.name)}</option>`).join("")}
            </select>
          </label>
          <label>Aplicar a
            <select name="memberId" required>
              <option value="${ALL_MEMBERS}">Todos los miembros</option>
              ${state.familyMembers.map(member => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join("")}
            </select>
          </label>
          <label>Modo de aplicación
            <select name="applyMode">
              <option value="empty">Rellenar solo huecos vacíos</option>
              <option value="replace">Sustituir lo que haya</option>
            </select>
          </label>
        </div>
      </section>

      <section class="planner-section">
        <h3>3. Filtros rápidos</h3>
        <div class="form-grid">
          <label>Buscar receta, etiqueta o categoría<input name="includeText" placeholder="Ej. desayuno, pollo, rápido, diabético"></label>
          <label>Excluir ingrediente o palabra<input name="excludeText" placeholder="Ej. gluten, leche, frutos secos"></label>
        </div>
        <p class="small muted">El filtro revisa nombre, categoría, etiquetas, notas e ingredientes de cada receta.</p>
      </section>

      <section class="planner-section">
        <div class="section-title-row">
          <div>
            <h3>4. Recetas disponibles</h3>
            <p class="muted">Marca varias para alternarlas durante los días seleccionados.</p>
          </div>
          <span class="badge">${state.dishes.length} receta(s)</span>
        </div>
        ${state.dishes.length ? `<div class="planner-dish-list">${state.dishes.map(dish => renderDishChoice(state, dish)).join("")}</div>` : `<p class="muted">Todavía no hay recetas. Importa packs o crea platos antes de usar el asistente.</p>`}
      </section>

      <section class="planner-preview-card">
        <strong>Resumen</strong>
        <p class="muted">Semana: ${escapeHtml(week?.name || "Sin semana activa")}. Se asignará una receta por hueco seleccionado, rotando las recetas marcadas.</p>
      </section>

      <div class="actions">
        <button type="submit">Aplicar planificación</button>
        <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
      </div>
    </form>
  `;
}

function renderDishChoice(state, dish) {
  const meta = dishSearchText(state, dish);
  return `
    <label class="planner-dish-choice">
      <input type="checkbox" name="dishIds" value="${escapeHtml(dish.id)}">
      <span>
        <strong>${escapeHtml(dish.name)}</strong>
        <small>${escapeHtml([dish.category, ...(dish.tags || [])].filter(Boolean).join(" · ") || "Sin etiquetas")}</small>
        <span class="visually-hidden">${escapeHtml(meta)}</span>
      </span>
    </label>
  `;
}

function applyWeekPlanner(form) {
  const state = getState();
  const data = new FormData(form);
  const days = data.getAll("days");
  const mealId = String(data.get("mealId") || "");
  const memberId = String(data.get("memberId") || "");
  const applyMode = String(data.get("applyMode") || "empty");
  const includeText = normalizeSearch(data.get("includeText"));
  const excludeText = normalizeSearch(data.get("excludeText"));
  const selectedDishIds = data.getAll("dishIds").map(String);
  const matchingDishIds = selectedDishIds.filter(dishId => {
    const dish = state.dishes.find(item => item.id === dishId);
    if (!dish) return false;
    const text = normalizeSearch(dishSearchText(state, dish));
    return (!includeText || text.includes(includeText)) && (!excludeText || !text.includes(excludeText));
  });

  if (!days.length) throw new Error("Selecciona al menos un día.");
  if (!mealId) throw new Error("Selecciona una comida.");
  if (!matchingDishIds.length) throw new Error("Selecciona alguna receta que cumpla los filtros.");

  const targetMembers = memberId === ALL_MEMBERS
    ? state.familyMembers.map(member => member.id)
    : [memberId];

  let applied = 0;
  updateState(draft => {
    const week = draft.weeks.find(item => item.id === draft.activeWeekId);
    if (!week) throw new Error("No hay semana activa.");
    week.plan ||= {};
    let cursor = 0;
    for (const day of days) {
      for (const targetMemberId of targetMembers) {
        const slot = `${day}__${mealId}__${targetMemberId}`;
        const hasPlanned = (week.plan[slot] || []).length > 0;
        if (applyMode === "empty" && hasPlanned) continue;
        week.plan[slot] = [matchingDishIds[cursor % matchingDishIds.length]];
        cursor += 1;
        applied += 1;
      }
    }
  }, "week-planner-assistant");

  closeModal();
  showAlert(applied ? `Planificación aplicada en ${applied} hueco(s).` : "No había huecos vacíos que rellenar con ese criterio.");
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
  const button = event.target.closest('[data-action="open-week-planner-assistant"]');
  if (!button) return;
  openWeekPlannerAssistant();
});

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="week-planner-assistant"]');
  if (!form) return;
  event.preventDefault();
  try {
    applyWeekPlanner(form);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo aplicar la planificación.", "error");
  }
});
