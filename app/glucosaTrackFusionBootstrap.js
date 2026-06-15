import { getState, subscribe } from "./store.js";
import { buildGlucosaTrackMealInput, getGlucosaTrackPlannerSnapshot } from "./state/glucosaTrackAdapter.js";
import { buildGlucosaTrackSimulation } from "./state/glucosaTrackEngine.js";
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
  return {
    memberId: root.querySelector?.("[data-glucosa-member]")?.value || defaultMemberId(state),
    dishId: root.querySelector?.("[data-glucosa-dish]")?.value || defaultDishId(state),
    currentGlucose: root.querySelector?.("[data-glucosa-current]")?.value || "",
    mealOffset: root.querySelector?.("[data-glucosa-offset]")?.value || "0",
    strategy: root.querySelector?.("[data-glucosa-strategy]")?.value || "split",
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

function renderSvgChart(simulation) {
  const model = simulation.model;
  const withInsulin = simulation.withInsulin;
  const width = 820;
  const height = 360;
  const pad = { left: 48, right: 18, top: 24, bottom: 38 };
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
    ...(withInsulin?.glucose || [])
  ];
  const targetMin = num(model.config.targetMin, 70);
  const targetMax = num(model.config.targetMax, 140);
  const minGlucose = Math.min(50, targetMin, ...allGlucoseValues) - 10;
  const maxGlucose = Math.max(180, targetMax, ...allGlucoseValues) + 18;
  const minTime = Math.min(...model.times);
  const maxTime = Math.max(...model.times);
  const x = time => pad.left + ((time - minTime) / (maxTime - minTime)) * plotW;
  const y = value => pad.top + ((maxGlucose - value) / (maxGlucose - minGlucose)) * plotH;
  const yTicks = [60, 70, 100, 140, 180, 220, 260].filter(tick => tick >= minGlucose && tick <= maxGlucose);
  const xTicks = [-30, 0, 120, 240, 360, 480, 600];
  const path = key => pathFrom(series.filter(point => point[key] !== null), point => x(point.time), point => y(point[key]));
  const effectMax = Math.max(...series.map(point => point.insulinEffect), 1);
  const effectPath = pathFrom(series, point => x(point.time), point => pad.top + plotH - (point.insulinEffect / effectMax) * plotH * 0.38);

  return `
    <div class="glucosa-chart-card">
      <svg class="glucosa-fusion-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva GlucosaTrack con basal, macros e insulina">
        <rect x="${pad.left}" y="${y(targetMax)}" width="${plotW}" height="${Math.max(0, y(targetMin) - y(targetMax))}" rx="10" fill="#D0F0EA" opacity="0.6"></rect>
        ${yTicks.map(tick => `<path d="M${pad.left},${y(tick).toFixed(1)} H${width - pad.right}" stroke="#E5EFEA" stroke-width="1"></path><text x="10" y="${(y(tick) + 4).toFixed(1)}" font-size="11" fill="#6B8F88">${tick}</text>`).join("")}
        ${xTicks.map(tick => `<path d="M${x(tick).toFixed(1)},${pad.top} V${height - pad.bottom}" stroke="#F0F5F3" stroke-width="1"></path><text x="${x(tick).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#6B8F88">${tick < 0 ? "-" : ""}${Math.abs(tick)}m</text>`).join("")}
        <path d="${path("basal")}" stroke="#64748B" stroke-width="3" stroke-dasharray="7 7" fill="none" opacity="0.9"></path>
        <path d="${path("simple")}" stroke="#F97316" stroke-width="2" fill="none" opacity="0.50"></path>
        <path d="${path("complex")}" stroke="#3B82F6" stroke-width="2" fill="none" opacity="0.50"></path>
        <path d="${path("protein")}" stroke="#A855F7" stroke-width="2" fill="none" opacity="0.50"></path>
        <path d="${path("fat")}" stroke="#0F766E" stroke-width="2" fill="none" opacity="0.55"></path>
        <path d="${path("noIns")}" stroke="#B45309" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        ${withInsulin ? `<path d="${path("withIns")}" stroke="#1A7F6E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="${effectPath}" stroke="#8B5CF6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.70"></path>` : ""}
        <text x="${width - 18}" y="${y(targetMin).toFixed(1)}" text-anchor="end" font-size="11" fill="#0F5A4D">rango objetivo</text>
      </svg>
      <div class="glucosa-legend">
        <span><i class="dot basal"></i>Basal</span>
        <span><i class="dot noins"></i>Sin insulina</span>
        <span><i class="dot glucose"></i>Con insulina</span>
        <span><i class="dot insulin"></i>Efecto insulina</span>
        <span><i class="dot simple"></i>Azúcares</span>
        <span><i class="dot complex"></i>Complejos</span>
        <span><i class="dot protein"></i>Proteína</span>
        <span><i class="dot fat"></i>Grasa</span>
      </div>
    </div>
  `;
}

function renderDoses(plan) {
  if (!plan.doses.length) return `<p class="muted">No se propone bolo porque el cálculo resultó 0 U.</p>`;
  return plan.doses.map(dose => `<div class="dose-row"><span class="dose-pill">💉 ${fmt(dose.units, 1)} U</span><span class="dose-time">${dose.time < 0 ? `${Math.abs(dose.time)} min antes` : dose.time === 0 ? "al inicio" : `${dose.time} min después`} · ${escapeHtml(dose.kind || "bolo")}</span></div>`).join("");
}

function renderResult(state, controls) {
  if (!state.familyMembers.length || !state.dishes.length) {
    return `<div class="empty-state"><div class="emoji">🍽️</div><div class="title">Faltan datos del planificador</div><div class="sub">Añade miembros, ingredientes con nutrición y un plato.</div></div>`;
  }

  let input;
  let simulation;
  try {
    input = buildGlucosaTrackMealInput({
      state,
      dishId: controls.dishId,
      memberId: controls.memberId,
      currentGlucose: controls.currentGlucose,
      mealOffset: controls.mealOffset,
      conditions: controls.conditions
    });
    simulation = buildGlucosaTrackSimulation(input, { strategy: controls.strategy || "split" });
  } catch (error) {
    return `<p class="alert">${escapeHtml(error.message || "No se pudo preparar el cálculo GlucosaTrack.")}</p>`;
  }

  const nutrition = input.nutrition.total;
  const model = simulation.model;
  const noInsPeak = peakInfo(model.times, model.glucoseNoIns);
  const withInsPeak = simulation.withInsulin ? peakInfo(model.times, simulation.withInsulin.glucose) : null;
  const withInsMin = simulation.withInsulin ? minInfo(model.times, simulation.withInsulin.glucose) : null;
  const plan = simulation.optimizedPlan;
  const risk = withInsPeak && withInsPeak.value > model.config.targetMax ? "warning" : withInsMin && withInsMin.value < model.config.targetMin ? "danger" : "safe";

  return `
    <div class="glucosa-summary-grid">
      <div class="glucosa-kpi"><span>Plato</span><strong>${escapeHtml(input.dish.name)}</strong><small>${fmt(nutrition.kcal)} kcal · HC ${fmt(nutrition.carbs, 1)} g</small></div>
      <div class="glucosa-kpi"><span>Modelo GlucosaTrack</span><strong>${fmt(simulation.warsaw.totalMealUnits, 1)} U</strong><small>HC ${fmt(simulation.warsaw.carbUnits, 1)} U · grasa/proteína ${fmt(simulation.warsaw.fpUnits, 1)} U · UGP ${fmt(simulation.warsaw.ugp, 2)}</small></div>
      <div class="glucosa-kpi ${risk}"><span>Pico con plan</span><strong>${withInsPeak ? fmt(withInsPeak.value) : "—"} mg/dL</strong><small>sin insulina ${fmt(noInsPeak.value)} mg/dL · basal ${fmt(model.basal.at(-1))} mg/dL</small></div>
    </div>

    ${renderSvgChart(simulation)}

    <div class="glucosa-summary-grid two">
      <div class="glucosa-kpi"><span>Desglose absorción</span><strong>${fmt(simulation.warsaw.carbEq, 1)} g eq.</strong><small>Azúcares ${fmt(simulation.warsaw.totals.sugars, 1)} · HC complejos ${fmt(simulation.warsaw.totals.complexCarbs, 1)} · proteína ${fmt(simulation.warsaw.totals.proteins, 1)} · grasa ${fmt(simulation.warsaw.totals.fats, 1)} · duración UGP ~${fmt(simulation.warsaw.extendedMinutes / 60, 1)} h</small></div>
      <div class="glucosa-kpi insulin"><span>Plan educativo de insulina</span><strong>${fmt(plan.totalUnits, 1)} U</strong><small>Corrección ${fmt(plan.correctionUnits, 1)} U · ISF efectivo ${fmt(simulation.warsaw.effISF, 1)} mg/dL/U · factor ${fmt(model.conditionMultiplier, 2)}×</small></div>
    </div>

    <div class="glucosa-dose-card">
      <div class="card-title">💉 Dosis simuladas sobre la curva</div>
      ${renderDoses(plan)}
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
    strategy: controls.strategy || "split",
    conditions: controls.conditions || { sick: false, menstruation: false }
  };

  return `
    <style>
      .glucosa-fusion-card{background:linear-gradient(135deg,#F2FAF7,#FFFFFF);border:1px solid #DCEDE8;border-radius:22px;padding:18px;box-shadow:0 12px 34px rgba(15,90,77,.08);margin-bottom:16px}.glucosa-fusion-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}.glucosa-fusion-head h2{margin:0;font-size:1.5rem}.glucosa-source-pill{border-radius:999px;background:#D0F0EA;color:#0F5A4D;padding:6px 12px;font-weight:800;font-size:.8rem}.glucosa-controls{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:14px 0}.glucosa-controls label{font-size:.78rem;font-weight:800;color:#53786F;display:flex;flex-direction:column;gap:5px}.glucosa-controls input,.glucosa-controls select{border:1px solid #CFE4DE;border-radius:12px;padding:10px 12px;font:inherit;background:#fff;color:#0E2B24;min-width:0}.glucosa-condition-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.glucosa-condition-row label{display:inline-flex;gap:7px;align-items:center;border:1px solid #DCEDE8;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#53786F}.glucosa-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.glucosa-summary-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.glucosa-kpi,.glucosa-dose-card{background:#fff;border:1px solid #E5F0EC;border-radius:16px;padding:14px}.glucosa-kpi span{display:block;color:#6B8F88;font-weight:800;font-size:.78rem}.glucosa-kpi strong{display:block;color:#0F5A4D;font-size:1.25rem;margin:4px 0}.glucosa-kpi small{color:#53786F;line-height:1.35}.glucosa-kpi.warning strong{color:#B45309}.glucosa-kpi.danger strong{color:#B91C1C}.glucosa-kpi.safe strong{color:#047857}.glucosa-kpi.insulin strong{color:#6D28D9}.glucosa-chart-card{background:#fff;border:1px solid #E5F0EC;border-radius:18px;padding:10px;overflow:hidden}.glucosa-fusion-chart{width:100%;height:auto;display:block}.glucosa-legend{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:.78rem;color:#53786F;font-weight:700}.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px}.dot.basal{background:#64748B}.dot.noins{background:#B45309}.dot.glucose{background:#1A7F6E}.dot.insulin{background:#8B5CF6}.dot.simple{background:#F97316}.dot.complex{background:#3B82F6}.dot.protein{background:#A855F7}.dot.fat{background:#0F766E}.glucosa-footer-warning{background:#FFFBEB;border:1px solid rgba(245,158,11,.35);border-radius:16px;padding:12px 14px;color:#78350F;font-size:.9rem;margin-top:14px}.dose-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F0F5F3}.dose-row:last-child{border-bottom:none}.dose-pill{background:rgba(139,92,246,.12);color:#6D28D9;font-weight:900;font-size:.86rem;border-radius:8px;padding:4px 10px;white-space:nowrap}.dose-time{font-size:.86rem;color:#53786F;font-weight:700}@media(max-width:900px){.glucosa-controls,.glucosa-summary-grid,.glucosa-summary-grid.two{grid-template-columns:1fr}.glucosa-fusion-card{padding:14px}}
    </style>
    <article class="glucosa-fusion-card" data-glucosa-fusion>
      <div class="glucosa-fusion-head">
        <div><p class="eyebrow">Fusión experimental</p><h2>GlucosaTrack integrado</h2><p class="muted">El planificador es la base de datos. El cálculo usa basal, azúcares simples, HC complejos, proteína, grasa e insulina simulada.</p></div>
        <span class="glucosa-source-pill">${snapshot.dishes.length} platos · ${snapshot.members.length} miembros</span>
      </div>
      <div class="warning-card"><span style="font-size:18px;flex-shrink:0;margin-top:1px">⚠️</span><div class="warning-text"><strong>Aviso:</strong> simulación educativa no validada clínicamente. No sirve para decidir dosis, tratamientos ni cambios médicos sin profesional sanitario.</div></div>
      <div class="glucosa-controls">
        <label>Miembro<select data-glucosa-member>${renderOptions(state.familyMembers, selectedMemberId)}</select></label>
        <label>Plato<select data-glucosa-dish>${renderOptions(state.dishes, selectedDishId)}</select></label>
        <label>Glucosa actual<input data-glucosa-current type="number" min="40" max="400" value="${escapeHtml(String(currentGlucose))}"></label>
        <label>Min hasta comer<input data-glucosa-offset type="number" min="0" max="120" value="${escapeHtml(String(normalizedControls.mealOffset))}"></label>
        <label>Estrategia<select data-glucosa-strategy><option value="single" ${normalizedControls.strategy === "single" ? "selected" : ""}>Dosis única</option><option value="split" ${normalizedControls.strategy === "split" ? "selected" : ""}>Dividida</option><option value="multi" ${normalizedControls.strategy === "multi" ? "selected" : ""}>Extendida múltiple</option></select></label>
      </div>
      <div class="glucosa-condition-row"><label><input data-glucosa-sick type="checkbox" ${normalizedControls.conditions.sick ? "checked" : ""}> Enfermedad</label><label><input data-glucosa-menstruation type="checkbox" ${normalizedControls.conditions.menstruation ? "checked" : ""}> Menstruación</label></div>
      <div data-glucosa-result>${renderResult(state, normalizedControls)}</div>
      <div class="actions wrap" style="margin-top:14px"><button type="button" data-action="open-member-metabolic-profile" data-member-id="${escapeHtml(selectedMemberId)}">Editar perfil metabólico</button></div>
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
  if (!event.target.matches("[data-glucosa-member], [data-glucosa-dish], [data-glucosa-current], [data-glucosa-offset], [data-glucosa-strategy], [data-glucosa-sick], [data-glucosa-menstruation]")) return;
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
