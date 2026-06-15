import { getState, updateState } from "./store.js";
import { escapeHtml, parseNumber } from "./utils.js";
import { openModal, closeModal, showAlert, formToObject } from "./render/ui.js";
import { DEFAULT_GLUCOSE_PROFILE } from "./state/glucosaTrackAdapter.js";

function settingsFor(member = {}) {
  return { ...DEFAULT_GLUCOSE_PROFILE, profileType: "diabetes", ...(member.metabolicSettings || {}) };
}

function numericField(name, label, settings, attrs = "") {
  return `<label>${label}<input name="${name}" type="number" ${attrs} value="${escapeHtml(String(settings[name]))}"></label>`;
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

      <h3>Perfil y objetivos</h3>
      <div class="form-grid">
        <label>Activar perfil<select name="enabled"><option value="false" ${!settings.enabled ? "selected" : ""}>No</option><option value="true" ${settings.enabled ? "selected" : ""}>Sí</option></select></label>
        <label>Diabetes / glucosa<select name="diabetes"><option value="false" ${!settings.diabetes ? "selected" : ""}>No</option><option value="true" ${settings.diabetes ? "selected" : ""}>Sí</option></select></label>
        ${numericField("baseGlucose", "Glucosa base", settings, "min=\"40\" max=\"400\"")}
        ${numericField("targetMin", "Objetivo mínimo", settings, "min=\"40\" max=\"250\"")}
        ${numericField("targetMax", "Objetivo máximo", settings, "min=\"50\" max=\"300\"")}
        ${numericField("hypoThreshold", "Umbral hipo", settings, "min=\"40\" max=\"120\"")}
      </div>

      <h3>Insulina y basal</h3>
      <div class="form-grid">
        ${numericField("carbRatio", "Ratio HC/insulina", settings, "min=\"1\" max=\"60\" step=\"0.1\"")}
        ${numericField("insulinSensitivity", "Sensibilidad mg/dL/U", settings, "min=\"1\" max=\"200\"")}
        ${numericField("basalDecayPerHour", "Compensación basal mg/dL/h", settings, "min=\"0\" max=\"20\" step=\"0.1\"")}
        ${numericField("insulinOnset", "Inicio insulina min", settings, "min=\"0\" max=\"180\"")}
        ${numericField("insulinPeakTime", "Pico insulina min", settings, "min=\"10\" max=\"360\"")}
        ${numericField("insulinDuration", "Duración insulina min", settings, "min=\"60\" max=\"720\"")}
        ${numericField("doseRoundStep", "Redondeo dosis", settings, "min=\"0.1\" max=\"2\" step=\"0.1\"")}
        ${numericField("doseMin", "Dosis mínima", settings, "min=\"0.1\" max=\"2\" step=\"0.1\"")}
        ${numericField("maxAutoDosePerShot", "Máx. por dosis", settings, "min=\"1\" max=\"30\" step=\"0.5\"")}
        ${numericField("maxAutoTotalDose", "Máx. total automático", settings, "min=\"1\" max=\"60\" step=\"0.5\"")}
      </div>

      <h3>Absorción del plato</h3>
      <div class="form-grid">
        ${numericField("simpleSugarTime", "Pico azúcares min", settings, "min=\"5\" max=\"180\"")}
        ${numericField("complexCarbTime", "Pico HC complejos min", settings, "min=\"20\" max=\"300\"")}
        ${numericField("proteinTime", "Pico proteína min", settings, "min=\"60\" max=\"480\"")}
        ${numericField("fatTime", "Pico grasa min", settings, "min=\"60\" max=\"600\"")}
        ${numericField("simpleDuration", "Duración azúcares min", settings, "min=\"30\" max=\"360\"")}
        ${numericField("complexDuration", "Duración complejos min", settings, "min=\"60\" max=\"480\"")}
        ${numericField("proteinDuration", "Duración proteína min", settings, "min=\"120\" max=\"720\"")}
        ${numericField("fatDuration", "Duración grasa min", settings, "min=\"120\" max=\"720\"")}
        ${numericField("proteinImpactFactor", "Factor proteína", settings, "min=\"0\" max=\"3\" step=\"0.1\"")}
        ${numericField("fatImpactFactor", "Factor grasa", settings, "min=\"0\" max=\"3\" step=\"0.1\"")}
        ${numericField("fatCarbDelayPer10g", "Retraso por 10g grasa", settings, "min=\"0\" max=\"60\" step=\"1\"")}
      </div>

      <h3>Condiciones temporales</h3>
      <div class="form-grid">
        ${numericField("sickMultiplier", "Factor enfermedad", settings, "min=\"1\" max=\"3\" step=\"0.1\"")}
        ${numericField("menstruationMultiplier", "Factor menstruación", settings, "min=\"1\" max=\"3\" step=\"0.1\"")}
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
      targetMin: parseNumber(data.targetMin, previous.targetMin),
      targetMax: parseNumber(data.targetMax, previous.targetMax),
      hypoThreshold: parseNumber(data.hypoThreshold, previous.hypoThreshold),
      carbRatio: parseNumber(data.carbRatio, previous.carbRatio),
      insulinSensitivity: parseNumber(data.insulinSensitivity, previous.insulinSensitivity),
      basalDecayPerHour: parseNumber(data.basalDecayPerHour, previous.basalDecayPerHour),
      insulinOnset: parseNumber(data.insulinOnset, previous.insulinOnset),
      insulinPeakTime: parseNumber(data.insulinPeakTime, previous.insulinPeakTime),
      insulinDuration: parseNumber(data.insulinDuration, previous.insulinDuration),
      doseRoundStep: parseNumber(data.doseRoundStep, previous.doseRoundStep),
      doseMin: parseNumber(data.doseMin, previous.doseMin),
      maxAutoDosePerShot: parseNumber(data.maxAutoDosePerShot, previous.maxAutoDosePerShot),
      maxAutoTotalDose: parseNumber(data.maxAutoTotalDose, previous.maxAutoTotalDose),
      simpleSugarTime: parseNumber(data.simpleSugarTime, previous.simpleSugarTime),
      complexCarbTime: parseNumber(data.complexCarbTime, previous.complexCarbTime),
      proteinTime: parseNumber(data.proteinTime, previous.proteinTime),
      fatTime: parseNumber(data.fatTime, previous.fatTime),
      simpleDuration: parseNumber(data.simpleDuration, previous.simpleDuration),
      complexDuration: parseNumber(data.complexDuration, previous.complexDuration),
      proteinDuration: parseNumber(data.proteinDuration, previous.proteinDuration),
      fatDuration: parseNumber(data.fatDuration, previous.fatDuration),
      proteinImpactFactor: parseNumber(data.proteinImpactFactor, previous.proteinImpactFactor),
      fatImpactFactor: parseNumber(data.fatImpactFactor, previous.fatImpactFactor),
      fatCarbDelayPer10g: parseNumber(data.fatCarbDelayPer10g, previous.fatCarbDelayPer10g),
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
