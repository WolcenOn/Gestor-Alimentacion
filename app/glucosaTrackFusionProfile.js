import { getState, updateState } from "./store.js";
import { escapeHtml, parseNumber } from "./utils.js";
import { openModal, closeModal, showAlert, formToObject } from "./render/ui.js";
import { DEFAULT_GLUCOSE_PROFILE } from "./state/glucosaTrackAdapter.js";

function settingsFor(member = {}) {
  return { ...DEFAULT_GLUCOSE_PROFILE, profileType: "diabetes", ...(member.metabolicSettings || {}) };
}

function openFusionProfile(memberId) {
  const state = getState();
  const member = state.familyMembers.find(item => item.id === memberId) || state.familyMembers[0];
  if (!member) return showAlert("Añade un miembro antes de editar el perfil metabólico.", "error");
  const settings = settingsFor(member);

  openModal(`
    <header>
      <div>
        <h2>Perfil GlucosaTrack · ${escapeHtml(member.name)}</h2>
        <p class="muted">Estos parámetros se guardan en el miembro del planificador. No se crea una base de datos aparte.</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <form data-form="glucosa-fusion-profile" data-member-id="${escapeHtml(member.id)}">
      <div class="warning-card">
        <span>⚠️</span>
        <div class="warning-text">Uso educativo. No utilizar para decidir dosis reales ni cambios terapéuticos.</div>
      </div>
      <div class="form-grid">
        <label>Activar perfil<select name="enabled"><option value="false" ${!settings.enabled ? "selected" : ""}>No</option><option value="true" ${settings.enabled ? "selected" : ""}>Sí</option></select></label>
        <label>Diabetes / glucosa<select name="diabetes"><option value="false" ${!settings.diabetes ? "selected" : ""}>No</option><option value="true" ${settings.diabetes ? "selected" : ""}>Sí</option></select></label>
        <label>Glucosa base<input name="baseGlucose" type="number" min="40" max="400" value="${escapeHtml(String(settings.baseGlucose))}"></label>
        <label>Ratio HC/insulina<input name="carbRatio" type="number" min="1" max="60" step="0.1" value="${escapeHtml(String(settings.carbRatio))}"></label>
        <label>Sensibilidad insulina<input name="insulinSensitivity" type="number" min="1" max="200" value="${escapeHtml(String(settings.insulinSensitivity))}"></label>
        <label>Objetivo mínimo<input name="targetMin" type="number" min="40" max="250" value="${escapeHtml(String(settings.targetMin))}"></label>
        <label>Objetivo máximo<input name="targetMax" type="number" min="50" max="300" value="${escapeHtml(String(settings.targetMax))}"></label>
        <label>Inicio insulina min<input name="insulinOnset" type="number" min="0" max="180" value="${escapeHtml(String(settings.insulinOnset))}"></label>
        <label>Pico insulina min<input name="insulinPeakTime" type="number" min="10" max="360" value="${escapeHtml(String(settings.insulinPeakTime))}"></label>
        <label>Duración insulina min<input name="insulinDuration" type="number" min="60" max="720" value="${escapeHtml(String(settings.insulinDuration))}"></label>
        <label>Factor enfermedad<input name="sickMultiplier" type="number" min="1" max="3" step="0.1" value="${escapeHtml(String(settings.sickMultiplier))}"></label>
        <label>Factor menstruación<input name="menstruationMultiplier" type="number" min="1" max="3" step="0.1" value="${escapeHtml(String(settings.menstruationMultiplier))}"></label>
      </div>
      <button>Guardar perfil GlucosaTrack</button>
    </form>
  `);
}

function saveFusionProfile(form) {
  const data = formToObject(form);
  const memberId = form.dataset.memberId;
  updateState(draft => {
    const member = draft.familyMembers.find(item => item.id === memberId);
    if (!member) throw new Error("Miembro no encontrado.");
    const previous = settingsFor(member);
    member.metabolicSettings = {
      ...previous,
      enabled: data.enabled === "true",
      profileType: "diabetes",
      diabetes: data.diabetes === "true",
      baseGlucose: parseNumber(data.baseGlucose, previous.baseGlucose),
      carbRatio: parseNumber(data.carbRatio, previous.carbRatio),
      insulinSensitivity: parseNumber(data.insulinSensitivity, previous.insulinSensitivity),
      targetMin: parseNumber(data.targetMin, previous.targetMin),
      targetMax: parseNumber(data.targetMax, previous.targetMax),
      insulinOnset: parseNumber(data.insulinOnset, previous.insulinOnset),
      insulinPeakTime: parseNumber(data.insulinPeakTime, previous.insulinPeakTime),
      insulinDuration: parseNumber(data.insulinDuration, previous.insulinDuration),
      sickMultiplier: parseNumber(data.sickMultiplier, previous.sickMultiplier),
      menstruationMultiplier: parseNumber(data.menstruationMultiplier, previous.menstruationMultiplier),
      disclaimerAccepted: true
    };
    member.updatedAt = new Date().toISOString();
  }, "glucosa-fusion-profile");
  closeModal();
  showAlert("Perfil GlucosaTrack guardado.");
}

document.addEventListener("click", event => {
  const button = event.target.closest?.("[data-action='open-member-metabolic-profile']");
  if (!button || !button.closest("[data-glucosa-fusion]")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openFusionProfile(button.dataset.memberId || "");
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest?.('form[data-form="glucosa-fusion-profile"]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try { saveFusionProfile(form); }
  catch (error) { console.error(error); showAlert(error.message || "No se pudo guardar el perfil GlucosaTrack.", "error"); }
}, true);
