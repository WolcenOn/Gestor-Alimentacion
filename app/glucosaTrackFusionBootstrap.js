import { getState, subscribe } from "./store.js";
import { buildGlucosaTrackMealInput, getGlucosaTrackPlannerSnapshot } from "./state/glucosaTrackAdapter.js";
import { buildGlucosaTrackSimulation, buildGlucoseWithInsulin } from "./state/glucosaTrackEngine.js";
import { escapeHtml } from "./utils.js";

let fusionActive = false;

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmt(value, decimals = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString("es-ES", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function memberSettings(member = {}) { return member.metabolicSettings || {}; }
function defaultMemberId(state) { return state.familyMembers.find(member => memberSettings(member).enabled)?.id || state.familyMembers[0]?.id || ""; }
function defaultDishId(state) { return state.dishes[0]?.id || ""; }

function collectDoses(root = document) {
  return [...(root.querySelectorAll?.("[data-glucosa-dose-row]") || [])]
    .map(row => ({
      time: num(row.querySelector("[data-dose-time]")?.value, 0),
      units: num(row.querySelector("[data-dose-units]")?.value, 0),
      kind: row.querySelector("[data-dose-kind]")?.value || "manual"
    }))
    .filter(dose => dose.units > 0);
}

function collectControls(root = document) {
  const state = getState();
  return {
    memberId: root.querySelector?.("[data-glucosa-member]")?.value || defaultMemberId(state),
    dishId: root.querySelector?.("[data-glucosa-dish]")?.value || defaultDishId(state),
    currentGlucose: root.querySelector?.("[data-glucosa-current]")?.value || "",
    mealOffset: root.querySelector?.("[data-glucosa-offset]")?.value || "0",
    strategy: root.querySelector?.("[data-glucosa-strategy]")?.value || "split",
    manualDoses: collectDoses(root),
    conditions: {
      sick: Boolean(root.querySelector?.("[data-glucosa-sick]")?.checked),
      menstruation: Boolean(root.querySelector?.("[data-glucosa-menstruation]")?.checked)
    }
  };
}

function renderOptions(items, selectedId) {
  return items.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function pathFrom(points, xFn, yFn) {
  return points.map((point, index) => `${index ? "L" : "M"}${xFn(point, index).toFixed(1)},${yFn(point, index).toFixed(1)}`).join(" ");
}

function peakInfo(times, values) {
  const peak = Math.max(...values);
  const index = values.findIndex(value => value === peak);
  return { value: peak, time: times[index] || 0 };
}

function minInfo(times, values) {
  const min = Math.min(...values);
  const index = values.findIndex(value => value === min);
  return { value: min, time: times[index] || 0 };
}

function niceStep(range) {
  if (range <= 80) return 10;
  if (range <= 140) return 20;
  if (range <= 260) return 40;
  return 50;
}

function buildTicks(min, max) {
  const step = niceStep(max - min);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let tick = start; tick <= end; tick += step) ticks.push(tick);
  return { ticks, min: start, max: end };
}

function formatTimeLabel(minutes) {
  if (minutes === 0) return "comida";
  if (minutes < 0) return `${minutes}m`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function renderSvgChart(simulation) {
  const model = simulation.model;
  const withInsulin = simulation.withInsulin;
  const width = 900;
  const height = 420;
  const pad = { left: 58, right: 22, top: 24, bottom: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const series = model.times.map((time, index) => ({
    time,
    basal: model.basal[index],
    simple: model.basal[index] + model.simple[index],
    complex: model.basal[index] + model.simple[index] + model.complex[index],
    protein: model.basal[index] + model.simple[index] + model.complex[index] + model.protein[index],
    fat: model.basal[index] + model.totalNutrients[index],
    noIns: model.glucoseNoIns[index],
    withIns: withInsulin?.glucose[index] ?? null,
    insulinEffect: withInsulin?.effect[index] ?? 0
  }));
  const allGlucoseValues = [
    ...model.basal,
    ...model.glucoseNoIns,
    ...(withInsulin?.glucose || []),
    num(model.config.targetMin, 70),
    num(model.config.targetMax, 140)
  ];
  const rawMin = Math.max(30, Math.min(...allGlucoseValues) - 18);
  const rawMax = Math.max(num(model.config.targetMax, 140) + 20, Math.max(...allGlucoseValues) + 18);
  const scale = buildTicks(rawMin, rawMax);
  const minTime = Math.min(...model.times);
  const maxTime = Math.max(...model.times);
  const x = time => pad.left + ((time - minTime) / (maxTime - minTime)) * plotW;
  const y = value => pad.top + ((scale.max - value) / (scale.max - scale.min)) * plotH;
  const targetMin = num(model.config.targetMin, 70);
  const targetMax = num(model.config.targetMax, 140);
  const xTicks = [-30, 0, 60, 120, 180, 240, 360, 480, 600].filter(tick => tick >= minTime && tick <= maxTime);
  const path = key => pathFrom(series.filter(point => point[key] !== null), point => x(point.time), point => y(point[key]));
  const effectMax = Math.max(...series.map(point => point.insulinEffect), 1);
  const effectPath = pathFrom(series, point => x(point.time), point => pad.top + plotH - (point.insulinEffect / effectMax) * plotH * 0.32);

  return `
    <div class="glucosa-chart-card">
      <svg class="glucosa-fusion-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva GlucosaTrack con escalas corregidas">
        <text x="${pad.left}" y="16" font-size="12" fill="#53786F" font-weight="800">Glucosa mg/dL</text>
        <text x="${width - pad.right}" y="${height - 14}" text-anchor="end" font-size="12" fill="#53786F" font-weight="800">Tiempo desde la comida</text>
        <rect x="${pad.left}" y="${y(targetMax)}" width="${plotW}" height="${Math.max(0, y(targetMin) - y(targetMax))}" rx="10" fill="#D0F0EA" opacity="0.62"></rect>
        ${scale.ticks.map(tick => `<path d="M${pad.left},${y(tick).toFixed(1)} H${width - pad.right}" stroke="#E5EFEA" stroke-width="1"></path><text x="${pad.left - 10}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#53786F">${tick}</text>`).join("")}
        ${xTicks.map(tick => `<path d="M${x(tick).toFixed(1)},${pad.top} V${height - pad.bottom}" stroke="#F0F5F3" stroke-width="1"></path><text x="${x(tick).toFixed(1)}" y="${height - 30}" text-anchor="middle" font-size="12" fill="#53786F">${formatTimeLabel(tick)}</text>`).join("")}
        <path d="M${pad.left},${height - pad.bottom} H${width - pad.right}" stroke="#BFD8D1" stroke-width="1.4"></path>
        <path d="M${pad.left},${pad.top} V${height - pad.bottom}" stroke="#BFD8D1" stroke-width="1.4"></path>
        <path d="${path("basal")}" stroke="#64748B" stroke-width="3" stroke-dasharray="7 7" fill="none" opacity="0.9"></path>
        <path d="${path("simple")}" stroke="#F97316" stroke-width="2" fill="none" opacity="0.48"></path>
        <path d="${path("complex")}" stroke="#3B82F6" stroke-width="2" fill="none" opacity="0.48"></path>
        <path d="${path("protein")}" stroke="#A855F7" stroke-width="2" fill="none" opacity="0.48"></path>
        <path d="${path("fat")}" stroke="#0F766E" stroke-width="2" fill="none" opacity="0.52"></path>
        <path d="${path("noIns")}" stroke="#B45309" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        ${withInsulin ? `<path d="${path("withIns")}" stroke="#1A7F6E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="${effectPath}" stroke="#8B5CF6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.70"></path>` : ""}
        <text x="${width - pad.right}" y="${(y(targetMin) - 5).toFixed(1)}" text-anchor="end" font-size="11" fill="#0F5A4D">rango objetivo</text>
      </svg>
      <div class="glucosa-legend">
        <span><i class="dot basal"></i>Basal</span><span><i class="dot noins"></i>Sin insulina</span><span><i class="dot glucose"></i>Con insulina</span><span><i class="dot insulin"></i>Efecto insulina</span><span><i class="dot simple"></i>Azúcares</span><span><i class="dot complex"></i>Complejos</span><span><i class="dot protein"></i>Proteína</span><span><i class="dot fat"></i>Grasa</span>
      </div>
    </div>
  `;
}

function normalizeDose(dose, index = 0) {
  return {
    time: Math.round(num(dose.time, index ? 90 : -10)),
    units: Math.max(0, num(dose.units, 0)),
    kind: dose.kind || (index ? "extendida" : "bolo")
  };
}

function renderDoses(doses, suggestedDoses) {
  const rows = (doses.length ? doses : suggestedDoses).map(normalizeDose);
  if (!rows.length) return `<p class="muted">No se propone bolo porque el cálculo resultó 0 U.</p>`;
  return `
    <div class="dose-edit-list">
      ${rows.map((dose, index) => `
        <div class="dose-edit-row" data-glucosa-dose-row>
          <label>U<input data-dose-units type="number" min="0" max="40" step="0.1" value="${fmt(dose.units, 1)}"></label>
          <label>Min<input data-dose-time type="number" min="-60" max="600" step="5" value="${dose.time}"></label>
          <label>Tipo<select data-dose-kind><option value="bolo" ${dose.kind === "bolo" ? "selected" : ""}>Bolo</option><option value="extendida" ${dose.kind === "extendida" ? "selected" : ""}>Extendida</option><option value="manual" ${dose.kind === "manual" ? "selected" : ""}>Manual</option></select></label>
          <button type="button" class="secondary" data-action="delete-glucosa-dose" title="Eliminar dosis">×</button>
        </div>
      `).join("")}
    </div>
    <div class="actions wrap" style="margin-top:10px">
      <button type="button" class="secondary" data-action="add-glucosa-dose">Añadir dosis</button>
      <button type="button" class="secondary" data-action="reset-glucosa-doses">Restaurar optimizador</button>
    </div>
  `;
}

function renderResult(state, controls) {
  if (!state.familyMembers.length || !state.dishes.length) {
    return `<div class="empty-state"><div class="emoji">🍽️</div><div class="title">Faltan datos del planificador</div><div class="sub">Añade miembros, ingredientes con nutrición y un plato.</div></div>`;
  }

  let input;
  let simulation;
  try {
    input = buildGlucosaTrackMealInput({ state, dishId: controls.dishId, memberId: controls.memberId, currentGlucose: controls.currentGlucose, mealOffset: controls.mealOffset, conditions: controls.conditions });
    simulation = buildGlucosaTrackSimulation(input, { strategy: controls.strategy || "split" });
  } catch (error) {
    return `<p class="alert">${escapeHtml(error.message || "No se pudo preparar el cálculo GlucosaTrack.")}</p>`;
  }

  const suggestedDoses = simulation.optimizedPlan.doses.map(normalizeDose);
  const activeDoses = (controls.manualDoses?.length ? controls.manualDoses : suggestedDoses).map(normalizeDose);
  const manualWithInsulin = buildGlucoseWithInsulin(simulation.model, activeDoses);
  const chartSimulation = { ...simulation, withInsulin: manualWithInsulin };
  const nutrition = input.nutrition.total;
  const model = simulation.model;
  const noInsPeak = peakInfo(model.times, model.glucoseNoIns);
  const withInsPeak = manualWithInsulin ? peakInfo(model.times, manualWithInsulin.glucose) : null;
  const withInsMin = manualWithInsulin ? minInfo(model.times, manualWithInsulin.glucose) : null;
  const totalUnits = activeDoses.reduce((sum, dose) => sum + num(dose.units, 0), 0);
  const risk = withInsPeak && withInsPeak.value > model.config.targetMax ? "warning" : withInsMin && withInsMin.value < model.config.targetMin ? "danger" : "safe";

  return `
    <div class="glucosa-summary-grid">
      <div class="glucosa-kpi"><span>Plato</span><strong>${escapeHtml(input.dish.name)}</strong><small>${fmt(nutrition.kcal)} kcal · HC ${fmt(nutrition.carbs, 1)} g</small></div>
      <div class="glucosa-kpi"><span>Modelo GlucosaTrack</span><strong>${fmt(simulation.warsaw.totalMealUnits, 1)} U</strong><small>HC ${fmt(simulation.warsaw.carbUnits, 1)} U · grasa/proteína ${fmt(simulation.warsaw.fpUnits, 1)} U · UGP ${fmt(simulation.warsaw.ugp, 2)}</small></div>
      <div class="glucosa-kpi ${risk}"><span>Pico con dosis</span><strong>${withInsPeak ? fmt(withInsPeak.value) : "—"} mg/dL</strong><small>mín. ${withInsMin ? fmt(withInsMin.value) : "—"} · sin insulina ${fmt(noInsPeak.value)} mg/dL</small></div>
    </div>
    ${renderSvgChart(chartSimulation)}
    <div class="glucosa-summary-grid two">
      <div class="glucosa-kpi"><span>Desglose absorción</span><strong>${fmt(simulation.warsaw.carbEq, 1)} g eq.</strong><small>Azúcares ${fmt(simulation.warsaw.totals.sugars, 1)} · HC complejos ${fmt(simulation.warsaw.totals.complexCarbs, 1)} · proteína ${fmt(simulation.warsaw.totals.proteins, 1)} · grasa ${fmt(simulation.warsaw.totals.fats, 1)} · UGP ~${fmt(simulation.warsaw.extendedMinutes / 60, 1)} h</small></div>
      <div class="glucosa-kpi insulin"><span>Dosis activa</span><strong>${fmt(totalUnits, 1)} U</strong><small>Optimizada sugerida ${fmt(simulation.optimizedPlan.totalUnits, 1)} U · corrección ${fmt(simulation.optimizedPlan.correctionUnits, 1)} U · ISF ${fmt(simulation.warsaw.effISF, 1)}</small></div>
    </div>
    <div class="glucosa-dose-card">
      <div class="card-title">💉 Ajustar dosis sobre la curva</div>
      <p class="muted" style="margin-top:-4px">Edita unidades o minuto de aplicación. La curva verde se recalcula con esos valores.</p>
      ${renderDoses(activeDoses, suggestedDoses)}
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
  const normalizedControls = { memberId: selectedMemberId, dishId: selectedDishId, currentGlucose, mealOffset: controls.mealOffset ?? 0, strategy: controls.strategy || "split", manualDoses: controls.manualDoses || [], conditions: controls.conditions || { sick: false, menstruation: false } };

  return `
    <style>
      .glucosa-fusion-card{background:linear-gradient(135deg,#F2FAF7,#FFFFFF);border:1px solid #DCEDE8;border-radius:22px;padding:18px;box-shadow:0 12px 34px rgba(15,90,77,.08);margin-bottom:16px}.glucosa-fusion-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}.glucosa-fusion-head h2{margin:0;font-size:1.5rem}.glucosa-source-pill{border-radius:999px;background:#D0F0EA;color:#0F5A4D;padding:6px 12px;font-weight:800;font-size:.8rem}.glucosa-controls{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:14px 0}.glucosa-controls label{font-size:.78rem;font-weight:800;color:#53786F;display:flex;flex-direction:column;gap:5px}.glucosa-controls input,.glucosa-controls select,.dose-edit-row input,.dose-edit-row select{border:1px solid #CFE4DE;border-radius:12px;padding:10px 12px;font:inherit;background:#fff;color:#0E2B24;min-width:0}.glucosa-condition-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.glucosa-condition-row label{display:inline-flex;gap:7px;align-items:center;border:1px solid #DCEDE8;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#53786F}.glucosa-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.glucosa-summary-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.glucosa-kpi,.glucosa-dose-card{background:#fff;border:1px solid #E5F0EC;border-radius:16px;padding:14px}.glucosa-kpi span{display:block;color:#6B8F88;font-weight:800;font-size:.78rem}.glucosa-kpi strong{display:block;color:#0F5A4D;font-size:1.25rem;margin:4px 0}.glucosa-kpi small{color:#53786F;line-height:1.35}.glucosa-kpi.warning strong{color:#B45309}.glucosa-kpi.danger strong{color:#B91C1C}.glucosa-kpi.safe strong{color:#047857}.glucosa-kpi.insulin strong{color:#6D28D9}.glucosa-chart-card{background:#fff;border:1px solid #E5F0EC;border-radius:18px;padding:10px;overflow:hidden}.glucosa-fusion-chart{width:100%;height:auto;display:block}.glucosa-legend{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:.78rem;color:#53786F;font-weight:700}.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px}.dot.basal{background:#64748B}.dot.noins{background:#B45309}.dot.glucose{background:#1A7F6E}.dot.insulin{background:#8B5CF6}.dot.simple{background:#F97316}.dot.complex{background:#3B82F6}.dot.protein{background:#A855F7}.dot.fat{background:#0F766E}.glucosa-footer-warning{background:#FFFBEB;border:1px solid rgba(245,158,11,.35);border-radius:16px;padding:12px 14px;color:#78350F;font-size:.9rem;margin-top:14px}.dose-edit-list{display:grid;gap:8px}.dose-edit-row{display:grid;grid-template-columns:120px 130px minmax(120px,1fr) 44px;gap:8px;align-items:end}.dose-edit-row label{font-size:.78rem;font-weight:800;color:#53786F;display:flex;flex-direction:column;gap:4px}@media(max-width:900px){.glucosa-controls,.glucosa-summary-grid,.glucosa-summary-grid.two,.dose-edit-row{grid-template-columns:1fr}.glucosa-fusion-card{padding:14px}}
    </style>
    <article class="glucosa-fusion-card" data-glucosa-fusion>
      <div class="glucosa-fusion-head"><div><p class="eyebrow">Fusión experimental</p><h2>GlucosaTrack integrado</h2><p class="muted">Cálculo con basal, macros e insulina ajustable.</p></div><span class="glucosa-source-pill">${snapshot.dishes.length} platos · ${snapshot.members.length} miembros</span></div>
      <div class="warning-card"><span style="font-size:18px;flex-shrink:0;margin-top:1px">⚠️</span><div class="warning-text"><strong>Aviso:</strong> simulación educativa no validada clínicamente. No sirve para decidir dosis, tratamientos ni cambios médicos sin profesional sanitario.</div></div>
      <div class="glucosa-controls"><label>Miembro<select data-glucosa-member>${renderOptions(state.familyMembers, selectedMemberId)}</select></label><label>Plato<select data-glucosa-dish>${renderOptions(state.dishes, selectedDishId)}</select></label><label>Glucosa actual<input data-glucosa-current type="number" min="40" max="400" value="${escapeHtml(String(currentGlucose))}"></label><label>Min hasta comer<input data-glucosa-offset type="number" min="0" max="120" value="${escapeHtml(String(normalizedControls.mealOffset))}"></label><label>Estrategia<select data-glucosa-strategy><option value="single" ${normalizedControls.strategy === "single" ? "selected" : ""}>Dosis única</option><option value="split" ${normalizedControls.strategy === "split" ? "selected" : ""}>Dividida</option><option value="multi" ${normalizedControls.strategy === "multi" ? "selected" : ""}>Extendida múltiple</option></select></label></div>
      <div class="glucosa-condition-row"><label><input data-glucosa-sick type="checkbox" ${normalizedControls.conditions.sick ? "checked" : ""}> Enfermedad</label><label><input data-glucosa-menstruation type="checkbox" ${normalizedControls.conditions.menstruation ? "checked" : ""}> Menstruación</label></div>
      <div data-glucosa-result>${renderResult(state, normalizedControls)}</div>
      <div class="actions wrap" style="margin-top:14px"><button type="button" data-action="open-member-metabolic-profile" data-member-id="${escapeHtml(selectedMemberId)}">Editar perfil metabólico</button></div>
      <div class="glucosa-footer-warning">Los datos proceden de ingredientes, platos y perfiles del Gestor. No se crea una segunda base de datos para GlucosaTrack.</div>
    </article>`;
}

function renderFusionTab(controls = collectControls()) {
  const root = document.getElementById("viewRoot");
  if (!root) return;
  fusionActive = true;
  document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === "metabolic"));
  root.innerHTML = renderFusionView(getState(), controls);
}

function refreshFusionResult(panel, overrides = {}) {
  const target = panel.querySelector("[data-glucosa-result]");
  const editButton = panel.querySelector("[data-action='open-member-metabolic-profile']");
  const controls = { ...collectControls(panel), ...overrides };
  if (editButton) editButton.dataset.memberId = controls.memberId || "";
  if (target) target.innerHTML = renderResult(getState(), controls);
}

document.addEventListener("click", event => {
  const tab = event.target.closest?.('[data-tab="metabolic"]');
  if (tab) { event.preventDefault(); event.stopImmediatePropagation(); renderFusionTab(); return; }
  const panel = event.target.closest?.("[data-glucosa-fusion]");
  if (!panel) return;
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (action === "add-glucosa-dose") {
    event.preventDefault();
    const controls = collectControls(panel);
    controls.manualDoses.push({ time: 90, units: 0.5, kind: "manual" });
    refreshFusionResult(panel, { manualDoses: controls.manualDoses });
  }
  if (action === "delete-glucosa-dose") {
    event.preventDefault();
    event.target.closest("[data-glucosa-dose-row]")?.remove();
    refreshFusionResult(panel);
  }
  if (action === "reset-glucosa-doses") {
    event.preventDefault();
    refreshFusionResult(panel, { manualDoses: [] });
  }
}, true);

document.addEventListener("change", event => {
  const panel = event.target.closest?.("[data-glucosa-fusion]");
  if (!panel) return;
  if (!event.target.matches("[data-glucosa-member], [data-glucosa-dish], [data-glucosa-current], [data-glucosa-offset], [data-glucosa-strategy], [data-glucosa-sick], [data-glucosa-menstruation], [data-dose-time], [data-dose-units], [data-dose-kind]")) return;
  const overrides = event.target.matches("[data-glucosa-strategy]") ? { manualDoses: [] } : {};
  refreshFusionResult(panel, overrides);
}, true);

document.addEventListener("input", event => {
  const panel = event.target.closest?.("[data-glucosa-fusion]");
  if (!panel) return;
  if (!event.target.matches("[data-glucosa-current], [data-glucosa-offset], [data-dose-time], [data-dose-units]")) return;
  refreshFusionResult(panel);
}, true);

subscribe(() => { if (fusionActive) renderFusionTab(collectControls()); });
window.__glucosaTrackFusion = { renderFusionTab, getPlannerSnapshot: () => getGlucosaTrackPlannerSnapshot(getState()) };
