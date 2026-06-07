import { computeDishNutrition, emptyNutrition, addNutrition } from "./nutritionCalculator.js";

export const GLYCEMIC_DEFAULTS = {
  simpleSugarTime: 30,
  complexCarbTime: 95,
  proteinTime: 240,
  fatTime: 320,
  simpleDuration: 90,
  complexDuration: 240,
  proteinDuration: 360,
  fatDuration: 480,
  proteinImpactFactor: 1,
  fatImpactFactor: 1,
  fatCarbDelayPer10g: 10,
  carbRatioReference: 10,
  sensitivityReference: 50
};

function round1(value) { return Math.round(Number(value || 0) * 10) / 10; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function betaShape01(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(x, Math.max(0.7, a - 1)) * Math.pow(1 - x, Math.max(0.7, b - 1));
}

function addDistributedLoad(arr, times, total, start, peak, end) {
  if (total <= 0 || end <= start || peak <= start || peak >= end) return;
  const peakNorm = (peak - start) / (end - start);
  const a = clamp(1 + peakNorm * 6, 1.2, 7);
  const b = clamp(1 + (1 - peakNorm) * 6, 1.2, 7);
  const weights = times.map(t => {
    if (t < start || t > end) return 0;
    return betaShape01((t - start) / (end - start), a, b);
  });
  const sum = weights.reduce((s, v) => s + v, 0);
  if (sum <= 0) return;
  for (let i = 0; i < arr.length; i += 1) arr[i] += total * (weights[i] / sum);
}

export function splitCarbs(nutrition) {
  const carbs = Number(nutrition?.carbs || 0);
  const sugar = Math.min(Number(nutrition?.sugar || 0), carbs);
  return { sugar, complexCarbs: Math.max(0, carbs - sugar) };
}

export function estimateGlycemicImpactFromNutrition(nutrition, options = {}) {
  const cfg = { ...GLYCEMIC_DEFAULTS, ...options };
  const { sugar, complexCarbs } = splitCarbs(nutrition);
  const protein = Number(nutrition?.protein || 0);
  const fat = Number(nutrition?.fat || 0);
  const fatDelay = (fat / 10) * cfg.fatCarbDelayPer10g;
  const proteinEq = (protein * 4 / 10) * cfg.proteinImpactFactor;
  const fatEq = (fat * 9 / 10) * cfg.fatImpactFactor;
  const carbEquivalent = sugar + complexCarbs + proteinEq + fatEq;
  const estimatedRise = (carbEquivalent / Math.max(1, cfg.carbRatioReference)) * cfg.sensitivityReference;

  let level = "bajo";
  if (estimatedRise >= 80 || sugar >= 25 || carbEquivalent >= 55) level = "alto";
  else if (estimatedRise >= 40 || sugar >= 12 || carbEquivalent >= 28) level = "medio";

  return {
    sugar: round1(sugar),
    complexCarbs: round1(complexCarbs),
    proteinEq: round1(proteinEq),
    fatEq: round1(fatEq),
    carbEquivalent: round1(carbEquivalent),
    estimatedRise: Math.round(estimatedRise),
    fatDelay: Math.round(fatDelay),
    level
  };
}

export function buildAbsorptionCurve(nutrition, options = {}) {
  const cfg = { ...GLYCEMIC_DEFAULTS, ...options };
  const times = [];
  for (let t = 0; t <= 600; t += 15) times.push(t);
  const simpleRate = new Array(times.length).fill(0);
  const complexRate = new Array(times.length).fill(0);
  const proteinRate = new Array(times.length).fill(0);
  const fatRate = new Array(times.length).fill(0);
  const { sugar, complexCarbs } = splitCarbs(nutrition);
  const protein = Number(nutrition?.protein || 0);
  const fat = Number(nutrition?.fat || 0);
  const proteinEq = (protein * 4 / 10) * cfg.proteinImpactFactor;
  const fatEq = (fat * 9 / 10) * cfg.fatImpactFactor;
  const fatDelay = (fat / 10) * cfg.fatCarbDelayPer10g;

  addDistributedLoad(simpleRate, times, sugar, 0, Math.max(10, cfg.simpleSugarTime), Math.max(cfg.simpleDuration, cfg.simpleSugarTime + 25) + fatDelay * 0.15);
  addDistributedLoad(complexRate, times, complexCarbs, 10 + fatDelay * 0.2, cfg.complexCarbTime + fatDelay * 0.55, Math.max(cfg.complexDuration, cfg.complexCarbTime + 80) + fatDelay);
  addDistributedLoad(proteinRate, times, proteinEq, 60 + fatDelay * 0.35, cfg.proteinTime + fatDelay * 0.75, cfg.proteinDuration);
  addDistributedLoad(fatRate, times, fatEq, 90, cfg.fatTime + fatDelay, cfg.fatDuration + (fat / 10) * 20);

  let simple = 0, complex = 0, proteinAcc = 0, fatAcc = 0;
  return times.map((time, index) => {
    simple += simpleRate[index];
    complex += complexRate[index];
    proteinAcc += proteinRate[index];
    fatAcc += fatRate[index];
    return {
      time,
      simple: round1(simple),
      complex: round1(complex),
      protein: round1(proteinAcc),
      fat: round1(fatAcc),
      total: round1(simple + complex + proteinAcc + fatAcc)
    };
  });
}

export function computeDishGlycemicProfile(state, dishId) {
  const dishNutrition = computeDishNutrition(state, dishId);
  const impact = estimateGlycemicImpactFromNutrition(dishNutrition.total);
  const curve = buildAbsorptionCurve(dishNutrition.total);
  return { ...dishNutrition, impact, curve };
}

export function computeWeekGlycemicSummary(state, weekId = state.activeWeekId) {
  const week = state.weeks.find(item => item.id === weekId);
  const byMember = {};
  const totals = emptyNutrition();
  const missingIngredientIds = new Set();
  if (!week) return { byMember, totals, missingIngredientIds };

  for (const member of state.familyMembers) {
    byMember[member.id] = { member, total: emptyNutrition(), impact: null, missingIngredientIds: new Set() };
  }

  for (const [slot, dishIds] of Object.entries(week.plan || {})) {
    const [, , memberId] = slot.split("__");
    const bucket = byMember[memberId];
    if (!bucket) continue;
    for (const dishId of dishIds || []) {
      const dishNutrition = computeDishNutrition(state, dishId);
      addNutrition(bucket.total, dishNutrition.total);
      addNutrition(totals, dishNutrition.total);
      for (const id of dishNutrition.missing) {
        bucket.missingIngredientIds.add(id);
        missingIngredientIds.add(id);
      }
    }
  }

  for (const bucket of Object.values(byMember)) {
    bucket.impact = estimateGlycemicImpactFromNutrition(bucket.total);
  }

  return { byMember, totals, missingIngredientIds, impact: estimateGlycemicImpactFromNutrition(totals) };
}
