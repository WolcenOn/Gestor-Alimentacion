import { getState, subscribe } from "./store.js";
import { buildGlucosaTrackMealInput, getGlucosaTrackPlannerSnapshot } from "./state/glucosaTrackAdapter.js";
import { escapeHtml } from "./utils.js";

let fusionActive = false;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmt(value, decimals = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString("es-ES", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function memberSettings(member = {}) {
  return member.metabolicSettings || {};
}

function defaultMemberId(state) {
  const advanced = state.familyMembers.find(member => memberSettings(member).enabled);
  return advanced?.id || state.familyMembers[0]?.id || "";
}

function defaultDishId(state) {
  return state.dishes[0]?.id || "";
}

function collectControls(root = document) {
  const state = getState();
  const memberId = root.querySelector?.("[data-glucosa-member]")?.value || defaultMemberId(state);
  const dishId = root.querySelector?.("[data-glucosa-dish]")?.value || defaultDishId(state);
  const currentGlucose = root.querySelector?.("[data-glucosa-current]")?.value || "";
  const mealOffset = root.querySelector?.("[data-glucosa-offset]")?.value || "0";
  return {
    memberId,
    dishId,
    currentGlucose,
    mealOffset,
    conditions: {
      sick: Boolean(root.querySelector?.("[data-glucosa-sick]")?.checked),
      menstruation: Boolean(root.querySelector?.("[data-glucosa-menstruation]")?.checked)
    }
  };
}

function renderOptions(items, selectedId) {
  return items.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function pathFrom(points, getX, getY) {
  return points.map((point, index) => `${index ? "L" : "M"}${getX(point).toFixed(1)},${getY(point).toFixed(1)}`).join(" ");
}

function projectedSeries(input) {
  const curve = input.glycemic.curve || [];
  const current = number(input.glucoseContext.currentGlucose, input.member.metabolicSettings.baseGlucose || 100);
  const rise = number(input.glycemic.impact.estimatedRise, 0);
  const maxTotal = Math.max(...curve.map(point => number(point.total, 0)), 1);
  const resistance = (input.glucoseContext.conditions.sick ? number(input.member.metabolicSettings.sickMultiplier, 1.5) : 1)
    * (input.glucoseContext.conditions.menstruation ? number(input.member.metabolicSettings.menstruationMultiplier, 1.3) : 1);
  return curve.map(point => ({
    ...point,
    projectedGlucose: Math.round(current + (number(point.total, 0) / maxTotal) * rise * resistance)
  }));
}

function renderSvgChart(input) {
  const series = projectedSeries(input);
  if (!series.length) return `<p class="muted">No hay datos suficientes para dibujar la curva.</p>`;

  const width = 760;
  const height = 300;
  const pad = { left: 46, right: 18, top: 20, bottom: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxTime = Math.max(...series.map(point => number(point.time, 0)), 1);
  const minGlucose = Math.min(60, input.member.metabolicSettings.targetMin || 70, ...series.map(point => point.projectedGlucose)) - 10;
  const maxGlucose = Math.max(180, input.member.metabolicSettings.targetMax || 140, ...series.map(point => point.projectedGlucose)) + 15;
  const y = value => pad.top + (maxGlucose - value) / (maxGlucose - minGlucose) * plotH;
  const x = time => pad.left + time / maxTime * plotW;
  const targetMin = number(input.member.metabolicSettings.targetMin, 70);
  const targetMax = number(input.member.metabolicSettings.targetMax, 140);
  const glucosePath = pathFrom(series, point => x(number(point.time, 0)), point => y(point.projectedGlucose));
  const totalMax = Math.max(...series.map(point => number(point.total, 0)), 1);
  const macroY = point => pad.top + plotH - (number(point.total, 0) / totalMax) * plotH * 0.72;
  const absorptionPath = pathFrom(series, point => x(number(point.time, 0)), macroY);
  const ticks = [0, 120, 240, 360, 480, 600].filter(t => t <= maxTime);
  const yTicks = [70, 100, 140, 180, 220].filter(t => t >= minGlucose && t <= maxGlucose);

  return `
    <div class="glucosa-chart-card">
      <svg class="glucosa-fusion-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva glucémica estimada del plato">
        <rect x="${pad.left}" y="${y(targetMax)}" width="${plotW}" height="${Math.max(0, y(targetMin) - y(targetMax))}" rx="10" fill="#D0F0EA" opacity="0.75"></rect>
        ${yTicks.map(tick => `<path d="M${pad.left},${y(tick).toFixed(1)} H${width - pad.right}" stroke="#E5EFEA" stroke-width="1"></path><text x="10" y="${(y(tick) + 4).toFixed(1)}" font-size="11" fill="#6B8F88">${tick}</text>`).join("")}
        ${ticks.map(tick => `<path d="M${x(tick).toFixed(1)},${pad.top} V${height - pad.bottom}" stroke="#F0F5F3" stroke-width="1"></path><text x="${x(tick).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#6B8F88">${Math.round(tick / 60)}h</text>`).join("")}
        <path d="${absorptionPath}" stroke="#3B82F6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.42"></path>
        <path d="${glucosePath}" stroke="#1A7F6E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        <text x="${width - 18}" y="${y(targetMin).toFixed(1)}" text-anchor="end" font-size="11" fill="#0F5A4D">rango objetivo</text>
      </svg>
      <div class="mini-facts">
        <span><i class="dot glucose"></i>Glucosa estimada</span>
        <span><i class="dot absorption"></i>Absorción del plato</span>
        <span>0-10 h</span>
      </div>
    </div>
  `;
}

function insulinSimulation(input) {
  const carbs = number(input.nutrition?.total?.carbs, 0);
  const settings = input.member.metabolicSettings || {};
  const current = number(input.glucoseContext.currentGlucose, settings.baseGlucose || 100);
  const carbRatio = Math.max(1, number(settings.carbRatio, 10));
  const sensitivity = Math.max(1, number(settings.insulinSensitivity, 50));
  const targetMax = number(settings.targetMax, 140);
  const foodUnits = carbs / carbRatio;
  const correctionUnits = Math.max(0, (current - targetMax) / sensitivity);
  const conditionFactor = (input.glucoseContext.conditions.sick ? number(settings.sickMultiplier, 1.5) : 1)
    * (input.glucoseContext.conditions.menstruation ? number(settings.menstruationMultiplier, 1.3) : 1);
  const total = (foodUnits + correctionUnits) * conditionFactor;
  return { carbs, foodUnits, correctionUnits, conditionFactor, total };
}

function renderResult(state, controls) {
  if (!state.familyMembers.length || !state.dishes.length) {
    return `<div class="empty-state"><div class="emoji">🍽️</div><div class="title">Faltan datos del planificador</div><div class="sub">Añade al menos un miembro, ingredientes con nutrición y un plato para calcular curvas.</div></div>`;
  }

  let input;
  try {
    input = buildGlucosaTrackMealInput({
      state,
      dishId: controls.dishId,
      memberId: controls.memberId,
      currentGlucose: controls.currentGlucose,
      mealOffset: controls.mealOffset,
      conditions: controls.conditions
    });
  } catch (error) {
    return `<p class="alert">${escapeHtml(error.message || "No se pudo preparar el plato para GlucosaTrack.")}</p>`;
  }

  const nutrition = input.nutrition.total;
  const impact = input.glycemic.impact;
  const projected = projectedSeries(input);
  const peak = Math.max(...projected.map(point => point.projectedGlucose));
  const peakPoint = projected.find(point => point.projectedGlucose === peak) || projected[0];
  const insulin = insulinSimulation(input);
  const risk = peak > input.member.metabolicSettings.targetMax ? "warning" : peak < input.member.metabolicSettings.targetMin ? "danger" : "safe";

  return `
    <div class="glucosa-summary-grid">
      <div class="glucosa-kpi"><span>Plato</span><strong>${escapeHtml(input.dish.name)}</strong><small>${fmt(nutrition.kcal)} kcal · HC ${fmt(nutrition.carbs, 1)} g</small></div>
      <div class="glucosa-kpi"><span>Impacto</span><strong>${escapeHtml(String(impact.level || "medio")).toUpperCase()}</strong><small>Subida teórica ${fmt(impact.estimatedRise)} mg/dL</small></div>
      <div class="glucosa-kpi ${risk}"><span>Pico estimado</span><strong>${fmt(peak)} mg/dL</strong><small>aprox. en ${fmt(number(peakPoint.time, 0) / 60, 1)} h</small></div>
    </div>

    ${renderSvgChart(input)}

    <div class="glucosa-summary-grid two">
      <div class="glucosa-kpi"><span>Desglose del plato</span><strong>${fmt(impact.carbEquivalent, 1)} g eq.</strong><small>Azúcares ${fmt(impact.sugar, 1)} · HC complejos ${fmt(impact.complexCarbs, 1)} · proteína ${fmt(nutrition.protein, 1)} · grasa ${fmt(nutrition.fat, 1)}</small></div>
      <div class="glucosa-kpi insulin"><span>Simulación educativa de insulina</span><strong>${fmt(insulin.total, 1)} U</strong><small>Comida ${fmt(insulin.foodUnits, 1)} U · corrección ${fmt(insulin.correctionUnits, 1)} U · factor ${fmt(insulin.conditionFactor, 2)}×</small></div>
    </div>
  `;
}

function renderFusionView(state = getState(), controls = {}) {
  const snapshot = getGlucosaTrackPlannerSnapshot(state);
  const selectedMemberId = controls.memberId || defaultMemberId(state);
  const selectedDishId = controls.dishId || defaultDishId(state);
  const selectedMember = state.familyMembers.find(member => member.id === selectedMemberId) || state.familyMembers[0] || {};
  const baseGlucose = memberSettings(selectedMember).baseGlucose || 100;
  const currentGlucose = controls.currentGlucose === undefined || controls.currentGlucose === "" ? baseGlucose : controls.currentGlucose;
  const normalizedControls = {
    memberId: selectedMemberId,
    dishId: selectedDishId,
    currentGlucose,
    mealOffset: controls.mealOffset ?? 0,
    conditions: controls.conditions || { sick: false, menstruation: false }
  };

  return `
    <style>
      .glucosa-fusion-card{background:linear-gradient(135deg,#F2FAF7,#FFFFFF);border:1px solid #DCEDE8;border-radius:22px;padding:18px;box-shadow:0 12px 34px rgba(15,90,77,.08);margin-bottom:16px}
      .glucosa-fusion-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
      .glucosa-fusion-head h2{margin:0;font-size:1.5rem}.glucosa-fusion-head p{margin:.3rem 0 0}
      .glucosa-source-pill{border-radius:999px;background:#D0F0EA;color:#0F5A4D;padding:6px 12px;font-weight:800;font-size:.8rem}
      .glucosa-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}
      .glucosa-controls label{font-size:.78rem;font-weight:800;color:#53786F;display:flex;flex-direction:column;gap:5px}
      .glucosa-controls input,.glucosa-controls select{border:1px solid #CFE4DE;border-radius:12px;padding:10px 12px;font:inherit;background:#fff;color:#0E2B24;min-width:0}
      .glucosa-condition-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.glucosa-condition-row label{display:inline-flex;gap:7px;align-items:center;border:1px solid #DCEDE8;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#53786F}
      .glucosa-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.glucosa-summary-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .glucosa-kpi{background:#fff;border:1px solid #E5F0EC;border-radius:16px;padding:14px}.glucosa-kpi span{display:block;color:#6B8F88;font-weight:800;font-size:.78rem}.glucosa-kpi strong{display:block;color:#0F5A4D;font-size:1.25rem;margin:4px 0}.glucosa-kpi small{color:#53786F;line-height:1.35}.glucosa-kpi.warning strong{color:#B45309}.glucosa-kpi.danger strong{color:#B91C1C}.glucosa-kpi.safe strong{color:#047857}.glucosa-kpi.insulin strong{color:#6D28D9}
      .glucosa-chart-card{background:#fff;border:1px solid #E5F0EC;border-radius:18px;padding:10px;overflow:hidden}.glucosa-fusion-chart{width:100%;height:auto;display:block}.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px}.dot.glucose{background:#1A7F6E}.dot.absorption{background:#3B82F6}
      .glucosa-footer-warning{background:#FFFBEB;border:1px solid rgba(245,158,11,.35);border-radius:16px;padding:12px 14px;color:#78350F;font-size:.9rem;margin-top:14px}
      @media(max-width:760px){.glucosa-controls,.glucosa-summary-grid,.glucosa-summary-grid.two{grid-template-columns:1fr}.glucosa-fusion-card{padding:14px}}
    </style>
    <article class="glucosa-fusion-card" data-glucosa-fusion>
      <div class="glucosa-fusion-head">
        <div>
          <p class="eyebrow">Fusión experimental</p>
          <h2>GlucosaTrack integrado</h2>
          <p class="muted">El planificador es la base de datos. Este panel solo consume platos, miembros, nutrición y perfiles metabólicos desde el Gestor.</p>
        </div>
        <span class="glucosa-source-pill">${snapshot.dishes.length} platos · ${snapshot.members.length} miembros</span>
      </div>

      <div class="warning-card">
        <span style="font-size:18px;flex-shrink:0;margin-top:1px">⚠️</span>
        <div class="warning-text"><strong>Aviso:</strong> simulación educativa no validada clínicamente. No sirve para decidir dosis, tratamientos ni cambios médicos sin profesional sanitario.</div>
      </div>

      <div class="glucosa-controls">
        <label>Miembro<select data-glucosa-member>${renderOptions(state.familyMembers, selectedMemberId)}</select></label>
        <label>Plato del planificador<select data-glucosa-dish>${renderOptions(state.dishes, selectedDishId)}</select></label>
        <label>Glucosa actual mg/dL<input data-glucosa-current type="number" min="40" max="400" value="${escapeHtml(String(currentGlucose))}"></label>
        <label>Minutos hasta comer<input data-glucosa-offset type="number" min="0" max="120" value="${escapeHtml(String(normalizedControls.mealOffset))}"></label>
      </div>
      <div class="glucosa-condition-row">
        <label><input data-glucosa-sick type="checkbox" ${normalizedControls.conditions.sick ? "checked" : ""}> Enfermedad</label>
        <label><input data-glucosa-menstruation type="checkbox" ${normalizedControls.conditions.menstruation ? "checked" : ""}> Menstruación</label>
      </div>

      <div data-glucosa-result>${renderResult(state, normalizedControls)}</div>
      <div class="actions wrap" style="margin-top:14px">
        <button type="button" data-action="open-member-metabolic-profile" data-member-id="${escapeHtml(selectedMemberId)}">Editar perfil metabólico</button>
      </div>
      <div class="glucosa-footer-warning">Los datos proceden de ingredientes, platos y perfiles del Gestor. No se crea una segunda base de datos para GlucosaTrack.</div>
    </article>
  `;
}

function renderFusionTab(controls = collectControls()) {
  const root = document.getElementById("viewRoot");
  if (!root) return;
  fusionActive = true;
  document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === "metabolic"));
  root.innerHTML = renderFusionView(getState(), controls);
}

function refreshFusionResult(panel) {
  const target = panel.querySelector("[data-glucosa-result]");
  const editButton = panel.querySelector("[data-action='open-member-metabolic-profile']");
  const controls = collectControls(panel);
  if (editButton) editButton.dataset.memberId = controls.memberId || "";
  if (target) target.innerHTML = renderResult(getState(), controls);
}

document.addEventListener("click", event => {
  const tab = event.target.closest?.('[data-tab="metabolic"]');
  if (!tab) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  renderFusionTab();
}, true);

document.addEventListener("change", event => {
  const panel = event.target.closest?.("[data-glucosa-fusion]");
  if (!panel) return;
  if (!event.target.matches("[data-glucosa-member], [data-glucosa-dish], [data-glucosa-current], [data-glucosa-offset], [data-glucosa-sick], [data-glucosa-menstruation]")) return;
  refreshFusionResult(panel);
}, true);

document.addEventListener("input", event => {
  const panel = event.target.closest?.("[data-glucosa-fusion]");
  if (!panel) return;
  if (!event.target.matches("[data-glucosa-current], [data-glucosa-offset]")) return;
  refreshFusionResult(panel);
}, true);

subscribe(() => {
  if (!fusionActive) return;
  renderFusionTab(collectControls());
});

window.__glucosaTrackFusion = { renderFusionTab, getPlannerSnapshot: () => getGlucosaTrackPlannerSnapshot(getState()) };
