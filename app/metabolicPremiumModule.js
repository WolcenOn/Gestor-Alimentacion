import { getState, updateState, subscribe } from "./store.js";
import { computeDishNutrition, formatNutritionValue } from "./state/nutritionCalculator.js";
import { estimateGlycemicImpactFromNutrition, buildAbsorptionCurve, splitCarbs } from "./state/glycemicCalculator.js";
import { escapeHtml, stripDangerousText, parseNumber } from "./utils.js";
import { openModal, closeModal, showAlert, formToObject } from "./render/ui.js";

const DEFAULT_METABOLIC_SETTINGS = {
  enabled: false,
  profileType: "general",
  age: "",
  heightCm: "",
  weightKg: "",
  activityLevel: "moderate",
  allergies: [],
  restrictions: [],
  diabetes: false,
  celiac: false,
  baseGlucose: 100,
  carbRatio: 10,
  insulinSensitivity: 50,
  targetMin: 70,
  targetMax: 140,
  insulinOnset: 15,
  insulinPeakTime: 75,
  insulinDuration: 240,
  simpleSugarTime: 30,
  complexCarbTime: 95,
  proteinTime: 240,
  fatTime: 320,
  sickMultiplier: 1.5,
  menstruationMultiplier: 1.3,
  disclaimerAccepted: false
};

function metabolicSettings(member = {}) {
  return { ...DEFAULT_METABOLIC_SETTINGS, ...(member.metabolicSettings || {}) };
}

function fieldList(value = []) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

function parseList(value = "") {
  return String(value || "").split(",").map(item => stripDangerousText(item.trim())).filter(Boolean);
}

function levelLabel(level) {
  return level === "alto" ? "Alto" : level === "medio" ? "Medio" : "Bajo";
}

function createCurvePath(points, width = 320, height = 120) {
  if (!points.length) return "";
  const max = Math.max(...points.map(point => Number(point.total) || 0), 1);
  const lastTime = Math.max(points.at(-1)?.time || 1, 1);
  return points.map((point, index) => {
    const x = (Number(point.time) || 0) / lastTime * width;
    const y = height - ((Number(point.total) || 0) / max * (height - 16)) - 8;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function renderMiniCurve(curve) {
  const sampled = curve.filter((_, index) => index % 4 === 0 || index === curve.length - 1);
  const path = createCurvePath(sampled);
  const max = Math.max(...sampled.map(point => Number(point.total) || 0), 1);
  return `
    <div class="metabolic-curve-wrap">
      <svg class="metabolic-curve" viewBox="0 0 320 120" role="img" aria-label="Curva estimada de absorción">
        <path d="M0,112 L320,112" class="metabolic-axis"></path>
        <path d="${path}" class="metabolic-line"></path>
      </svg>
      <div class="mini-facts">
        <span>Pico estimado: ${Math.round(max)} g eq.</span>
        <span>Ventana: 0-10 h</span>
        <span>Orientativo</span>
      </div>
    </div>
  `;
}

function renderMemberOptions(state, selectedId = "") {
  return state.familyMembers
    .map(member => `<option value="${escapeHtml(member.id)}" ${member.id === selectedId ? "selected" : ""}>${escapeHtml(member.name)}</option>`)
    .join("");
}

function renderDishOptions(state, selectedId = "") {
  return state.dishes
    .map(dish => `<option value="${escapeHtml(dish.id)}" ${dish.id === selectedId ? "selected" : ""}>${escapeHtml(dish.name)}</option>`)
    .join("");
}

function renderMemberBadge(member) {
  const settings = metabolicSettings(member);
  if (!settings.enabled) return `<span class="badge">básico</span>`;
  if (settings.diabetes) return `<span class="badge danger">glucosa</span>`;
  if (settings.profileType === "sport") return `<span class="badge warning">deporte</span>`;
  if (settings.profileType === "professional") return `<span class="badge">pro</span>`;
  return `<span class="badge">premium</span>`;
}

function renderMetabolicPanel(state = getState()) {
  const members = state.familyMembers || [];
  const premiumMembers = members.filter(member => metabolicSettings(member).enabled);
  const selectedMember = premiumMembers[0] || members[0];
  const selectedDish = state.dishes?.[0];
  const nutrition = selectedDish ? computeDishNutrition(state, selectedDish.id) : null;
  const memberSettings = metabolicSettings(selectedMember);
  const impact = nutrition ? estimateGlycemicImpactFromNutrition(nutrition.total, memberSettings) : null;
  const split = nutrition ? splitCarbs(nutrition.total) : null;

  return `
    <article class="card metabolic-premium-card" data-metabolic-premium>
      <div class="section-title-row">
        <div>
          <p class="eyebrow">Premium experimental</p>
          <h3>Simulación metabólica avanzada</h3>
          <p class="muted">Módulo inspirado en GlucosaTrack. Usa platos del gestor y ajustes por miembro. Es una herramienta educativa, no médica.</p>
        </div>
        <span class="badge ${premiumMembers.length ? "warning" : ""}">${premiumMembers.length} perfil(es)</span>
      </div>
      <div class="warning-card">
        <span style="font-size:18px;flex-shrink:0;margin-top:1px">⚠️</span>
        <div class="warning-text"><strong>Aviso:</strong> simulación no validada clínicamente. No sirve para decidir dosis, tratamientos ni cambios médicos sin profesional sanitario.</div>
      </div>
      <div class="form-grid">
        <label>Miembro
          <select data-metabolic-member>${renderMemberOptions(state, selectedMember?.id)}</select>
        </label>
        <label>Plato
          <select data-metabolic-dish>${renderDishOptions(state, selectedDish?.id)}</select>
        </label>
      </div>
      <div data-metabolic-result>${renderMetabolicResult(state, selectedMember?.id, selectedDish?.id)}</div>
      <div class="actions wrap">
        <button type="button" data-action="open-member-metabolic-profile" data-member-id="${escapeHtml(selectedMember?.id || "")}">Editar perfil metabólico</button>
      </div>
    </article>
  `;
}

function renderMetabolicResult(state, memberId, dishId) {
  const member = state.familyMembers.find(item => item.id === memberId) || state.familyMembers[0];
  const dish = state.dishes.find(item => item.id === dishId) || state.dishes[0];
  if (!member || !dish) return `<p class="muted">Añade miembros y platos para empezar.</p>`;
  const settings = metabolicSettings(member);
  const nutrition = computeDishNutrition(state, dish.id);
  const impact = estimateGlycemicImpactFromNutrition(nutrition.total, settings);
  const curve = buildAbsorptionCurve(nutrition.total, settings);
  const split = splitCarbs(nutrition.total);
  return `
    <div class="grid cols-3 metabolic-summary-grid">
      <div class="item"><strong>${escapeHtml(member.name)}</strong><p class="qty-line">${settings.enabled ? "Perfil avanzado activo" : "Perfil básico"} · ${settings.diabetes ? "diabetes/glucosa" : settings.profileType}</p></div>
      <div class="item"><strong>${escapeHtml(dish.name)}</strong><p class="qty-line">${formatNutritionValue("kcal", nutrition.total.kcal)} · HC ${formatNutritionValue("carbs", nutrition.total.carbs)}</p></div>
      <div class="item glycemic-level-${impact.level}"><strong>Impacto ${levelLabel(impact.level)}</strong><p class="qty-line">Subida teórica ${impact.estimatedRise} mg/dL · equiv. ${impact.carbEquivalent} g</p></div>
    </div>
    <div class="mini-facts">
      <span>Azúcares ${formatNutritionValue("sugar", impact.sugar)}</span>
      <span>HC complejos ${formatNutritionValue("carbs", impact.complexCarbs)}</span>
      <span>Proteína ${formatNutritionValue("protein", nutrition.total.protein)}</span>
      <span>Grasa ${formatNutritionValue("fat", nutrition.total.fat)}</span>
      <span>Fibra ${formatNutritionValue("fiber", nutrition.total.fiber)}</span>
    </div>
    ${renderMiniCurve(curve)}
    ${settings.allergies.length || settings.celiac ? `<p class="small muted">Restricciones del miembro: ${settings.celiac ? "celiaquía" : ""} ${escapeHtml(settings.allergies.join(", "))}</p>` : ""}
  `;
}

function openMemberMetabolicProfile(memberId) {
  const state = getState();
  const member = state.familyMembers.find(item => item.id === memberId) || state.familyMembers[0];
  if (!member) return;
  const settings = metabolicSettings(member);
  openModal(`
    <header>
      <div><h2>Perfil avanzado · ${escapeHtml(member.name)}</h2><p class="muted">Activa simulación metabólica, deporte, alergias y ajustes educativos de glucosa.</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <form data-form="metabolic-profile" data-member-id="${escapeHtml(member.id)}">
      <div class="form-grid">
        <label>Activar módulo premium<select name="enabled"><option value="false" ${!settings.enabled ? "selected" : ""}>No</option><option value="true" ${settings.enabled ? "selected" : ""}>Sí</option></select></label>
        <label>Tipo de perfil<select name="profileType"><option value="general" ${settings.profileType === "general" ? "selected" : ""}>General</option><option value="diabetes" ${settings.profileType === "diabetes" ? "selected" : ""}>Glucosa / diabetes</option><option value="sport" ${settings.profileType === "sport" ? "selected" : ""}>Deportista</option><option value="professional" ${settings.profileType === "professional" ? "selected" : ""}>Nutricionista / pro</option></select></label>
        <label>Edad<input name="age" type="number" min="0" max="120" value="${escapeHtml(settings.age)}"></label>
        <label>Altura cm<input name="heightCm" type="number" min="40" max="240" value="${escapeHtml(settings.heightCm)}"></label>
        <label>Peso kg<input name="weightKg" type="number" min="2" max="250" step="0.1" value="${escapeHtml(settings.weightKg)}"></label>
        <label>Actividad<select name="activityLevel"><option value="low" ${settings.activityLevel === "low" ? "selected" : ""}>Baja</option><option value="moderate" ${settings.activityLevel === "moderate" ? "selected" : ""}>Moderada</option><option value="high" ${settings.activityLevel === "high" ? "selected" : ""}>Alta</option><option value="athlete" ${settings.activityLevel === "athlete" ? "selected" : ""}>Deportista</option></select></label>
        <label>Diabético / glucosa<select name="diabetes"><option value="false" ${!settings.diabetes ? "selected" : ""}>No</option><option value="true" ${settings.diabetes ? "selected" : ""}>Sí</option></select></label>
        <label>Celíaco<select name="celiac"><option value="false" ${!settings.celiac ? "selected" : ""}>No</option><option value="true" ${settings.celiac ? "selected" : ""}>Sí</option></select></label>
        <label>Alergias<input name="allergies" placeholder="gluten, huevo, frutos secos..." value="${escapeHtml(fieldList(settings.allergies))}"></label>
        <label>Restricciones<input name="restrictions" placeholder="sin lactosa, vegetariano..." value="${escapeHtml(fieldList(settings.restrictions))}"></label>
        <label>Glucosa base<input name="baseGlucose" type="number" min="40" max="400" value="${settings.baseGlucose}"></label>
        <label>Ratio HC/insulina<input name="carbRatio" type="number" min="1" max="60" step="0.1" value="${settings.carbRatio}"></label>
        <label>Sensibilidad insulina<input name="insulinSensitivity" type="number" min="1" max="200" step="1" value="${settings.insulinSensitivity}"></label>
        <label>Objetivo mínimo<input name="targetMin" type="number" min="40" max="250" value="${settings.targetMin}"></label>
        <label>Objetivo máximo<input name="targetMax" type="number" min="50" max="300" value="${settings.targetMax}"></label>
        <label>Inicio insulina min<input name="insulinOnset" type="number" min="0" max="180" value="${settings.insulinOnset}"></label>
        <label>Pico insulina min<input name="insulinPeakTime" type="number" min="10" max="360" value="${settings.insulinPeakTime}"></label>
        <label>Duración insulina min<input name="insulinDuration" type="number" min="60" max="720" value="${settings.insulinDuration}"></label>
      </div>
      <div class="warning-card">
        <span>⚠️</span>
        <div class="warning-text">Estos cálculos son orientativos y educativos. No sustituyen a profesional médico, nutricionista colegiado ni pauta terapéutica.</div>
      </div>
      <button>Guardar perfil avanzado</button>
    </form>
  `);
}

function saveMetabolicProfile(form) {
  const data = formToObject(form);
  const memberId = form.dataset.memberId;
  updateState(draft => {
    const member = draft.familyMembers.find(item => item.id === memberId);
    if (!member) throw new Error("Miembro no encontrado.");
    member.metabolicSettings = {
      ...DEFAULT_METABOLIC_SETTINGS,
      enabled: data.enabled === "true",
      profileType: data.profileType || "general",
      age: parseNumber(data.age, ""),
      heightCm: parseNumber(data.heightCm, ""),
      weightKg: parseNumber(data.weightKg, ""),
      activityLevel: data.activityLevel || "moderate",
      diabetes: data.diabetes === "true" || data.profileType === "diabetes",
      celiac: data.celiac === "true",
      allergies: parseList(data.allergies),
      restrictions: parseList(data.restrictions),
      baseGlucose: parseNumber(data.baseGlucose, 100),
      carbRatio: parseNumber(data.carbRatio, 10),
      insulinSensitivity: parseNumber(data.insulinSensitivity, 50),
      targetMin: parseNumber(data.targetMin, 70),
      targetMax: parseNumber(data.targetMax, 140),
      insulinOnset: parseNumber(data.insulinOnset, 15),
      insulinPeakTime: parseNumber(data.insulinPeakTime, 75),
      insulinDuration: parseNumber(data.insulinDuration, 240),
      disclaimerAccepted: true
    };
    member.updatedAt = new Date().toISOString();
  }, "metabolic-profile");
  closeModal();
  showAlert("Perfil avanzado guardado.");
}

function injectSettingsButtons(state = getState()) {
  document.querySelectorAll(".member-row").forEach(row => {
    const removeButton = row.querySelector("[data-member-id]");
    const memberId = removeButton?.dataset.memberId;
    if (!memberId || row.querySelector("[data-action='open-member-metabolic-profile']")) return;
    const member = state.familyMembers.find(item => item.id === memberId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.dataset.action = "open-member-metabolic-profile";
    button.dataset.memberId = memberId;
    button.textContent = metabolicSettings(member).enabled ? "Perfil avanzado" : "Activar premium";
    removeButton.before(button);
    const badge = document.createElement("span");
    badge.innerHTML = renderMemberBadge(member);
    row.querySelector(".qty-line")?.after(badge.firstElementChild);
  });
}

function injectMetabolicPanel(state = getState()) {
  const nutritionList = document.querySelector(".nutrition-dish-list");
  if (!nutritionList || document.querySelector("[data-metabolic-premium]")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderMetabolicPanel(state);
  nutritionList.closest("article.card")?.before(wrapper.firstElementChild);
}

function refreshInjections() {
  const state = getState();
  injectSettingsButtons(state);
  injectMetabolicPanel(state);
}

subscribe(() => queueMicrotask(refreshInjections));
document.addEventListener("DOMContentLoaded", refreshInjections);
setTimeout(refreshInjections, 0);

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "open-member-metabolic-profile") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMemberMetabolicProfile(button.dataset.memberId);
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="metabolic-profile"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try { saveMetabolicProfile(form); }
  catch (error) { console.error(error); showAlert(error.message || "No se pudo guardar el perfil.", "error"); }
}, true);

document.addEventListener("change", event => {
  const panel = event.target.closest("[data-metabolic-premium]");
  if (!panel) return;
  if (!event.target.matches("[data-metabolic-member], [data-metabolic-dish]")) return;
  const memberId = panel.querySelector("[data-metabolic-member]")?.value;
  const dishId = panel.querySelector("[data-metabolic-dish]")?.value;
  const target = panel.querySelector("[data-metabolic-result]");
  if (target) target.innerHTML = renderMetabolicResult(getState(), memberId, dishId);
}, true);
