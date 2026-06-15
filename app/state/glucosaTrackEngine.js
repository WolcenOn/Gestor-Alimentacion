const ENGINE_VERSION = 2;

export const GLUCOSATRACK_ENGINE_DEFAULTS = {
  baseGlucose: 100,
  carbRatio: 10,
  insulinSensitivity: 50,
  targetMin: 70,
  targetMax: 140,
  idealTargetMargin: 10,
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
  basalDecayPerHour: 2.4,
  insulinOnset: 15,
  insulinPeakTime: 75,
  insulinDuration: 240,
  sickMultiplier: 1.5,
  menstruationMultiplier: 1.3,
  maxAutoDosePerShot: 8,
  maxAutoTotalDose: 18,
  doseRoundStep: 0.5,
  doseMin: 0.1,
  hypoThreshold: 70,
  hypoSafetyBuffer: 0,
  slowMealFpUnitsThreshold: 0.5,
  slowMealExtendedMinutesThreshold: 240
};

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function r1(value) { return Math.round(n(value) * 10) / 10; }
function r2(value) { return Math.round(n(value) * 100) / 100; }
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
  const weights = times.map(time => {
    if (time < start || time > end) return 0;
    return betaShape01((time - start) / (end - start), a, b);
  });
  const sum = weights.reduce((totalWeight, value) => totalWeight + value, 0);
  if (sum <= 0) return;
  for (let index = 0; index < arr.length; index += 1) arr[index] += total * (weights[index] / sum);
}

function normalizeConfig(input = {}) {
  const settings = input.member?.metabolicSettings || {};
  return { ...GLUCOSATRACK_ENGINE_DEFAULTS, ...settings };
}

function conditionMultiplier(input, config) {
  const conditions = input.glucoseContext?.conditions || {};
  return (conditions.sick ? n(config.sickMultiplier, 1.5) : 1)
    * (conditions.menstruation ? n(config.menstruationMultiplier, 1.3) : 1);
}

function nutritionTotals(input) {
  const total = input.nutrition?.total || {};
  const carbs = Math.max(0, n(total.carbs, 0));
  const sugar = clamp(n(total.sugar, 0), 0, carbs);
  return {
    kcal: Math.max(0, n(total.kcal, 0)),
    fats: Math.max(0, n(total.fat, 0)),
    proteins: Math.max(0, n(total.protein, 0)),
    carbs,
    sugars: sugar,
    complexCarbs: Math.max(0, carbs - sugar),
    fiber: Math.max(0, n(total.fiber, 0))
  };
}

function mealOffset(input) {
  return Math.max(0, n(input.glucoseContext?.mealOffset, 0));
}

function startGlucose(input, config) {
  return n(input.glucoseContext?.currentGlucose, n(config.baseGlucose, 100));
}

function idealTarget(config) {
  return (n(config.targetMin, 70) + n(config.targetMax, 140)) / 2;
}

function idealBand(config) {
  const ideal = idealTarget(config);
  const margin = Math.max(5, n(config.idealTargetMargin, 10));
  return {
    ideal,
    low: Math.max(n(config.hypoThreshold, 70) + n(config.hypoSafetyBuffer, 0), ideal - margin),
    high: ideal + margin
  };
}

function warsawDurationMinutes(ugp) {
  if (ugp <= 0) return 0;
  if (ugp <= 1) return 180;
  if (ugp <= 2) return 240;
  if (ugp <= 3) return 300;
  if (ugp <= 4) return 480;
  return clamp(480 + Math.round((ugp - 4) * 45), 480, 600);
}

export function getWarsawMealData(input) {
  const config = normalizeConfig(input);
  const totals = nutritionTotals(input);
  const multiplier = conditionMultiplier(input, config);
  const fpKcal = totals.fats * 9 * n(config.fatImpactFactor, 1) + totals.proteins * 4 * n(config.proteinImpactFactor, 1);
  const ugp = fpKcal / 100;
  const fpEq = fpKcal / 10;
  const carbEq = totals.carbs + fpEq;
  const carbRatio = Math.max(1, n(config.carbRatio, 10));
  const effISF = Math.max(1, n(config.insulinSensitivity, 50) / multiplier);
  return {
    totals,
    fpKcal: r1(fpKcal),
    ugp: r2(ugp),
    fpEq: r1(fpEq),
    carbEq: r1(carbEq),
    carbUnits: r2(totals.carbs / carbRatio),
    fpUnits: r2(fpEq / carbRatio),
    totalMealUnits: r2(carbEq / carbRatio),
    extendedMinutes: warsawDurationMinutes(ugp),
    effISF: r1(effISF)
  };
}

export function buildGlucosaTrackMetabolicModel(input) {
  const config = normalizeConfig(input);
  const totals = nutritionTotals(input);
  const labels = [];
  const times = [];
  for (let time = -30; time <= 600; time += 5) {
    const absolute = Math.abs(time);
    const hours = Math.floor(absolute / 60);
    const minutes = absolute % 60;
    labels.push(`${time < 0 ? "-" : ""}${hours}h${minutes > 0 ? String(minutes).padStart(2, "0") : ""}`);
    times.push(time);
  }

  const multiplier = conditionMultiplier(input, config);
  const start = startGlucose(input, config);
  const offset = mealOffset(input);
  const floor = Math.max(40, n(config.targetMin, 70) - 25);
  const effISF = Math.max(1, n(config.insulinSensitivity, 50) / multiplier);
  const carbRatio = Math.max(1, n(config.carbRatio, 10));
  const simpleRate = new Array(times.length).fill(0);
  const complexRate = new Array(times.length).fill(0);
  const proteinRate = new Array(times.length).fill(0);
  const fatRate = new Array(times.length).fill(0);

  const sugarG = totals.sugars;
  const complexG = totals.complexCarbs;
  const proteinG = totals.proteins;
  const fatG = totals.fats;
  const fatDelay = (fatG / 10) * n(config.fatCarbDelayPer10g, 10);
  const sugarLoad = (sugarG / carbRatio) * effISF;
  const complexLoad = (complexG / carbRatio) * effISF;
  const proteinEq = (proteinG * 4 / 10) * n(config.proteinImpactFactor, 1);
  const fatEq = (fatG * 9 / 10) * n(config.fatImpactFactor, 1);
  const proteinLoad = (proteinEq / carbRatio) * effISF;
  const fatLoad = (fatEq / carbRatio) * effISF;
  const ugp = (proteinG * 4 * n(config.proteinImpactFactor, 1) + fatG * 9 * n(config.fatImpactFactor, 1)) / 100;
  const extDur = warsawDurationMinutes(ugp);

  addDistributedLoad(simpleRate, times, sugarLoad, offset, offset + Math.max(10, n(config.simpleSugarTime, 30)), offset + Math.max(n(config.simpleDuration, 90), n(config.simpleSugarTime, 30) + 25) + fatDelay * 0.15);
  addDistributedLoad(complexRate, times, complexLoad, offset + 10 + fatDelay * 0.2, offset + n(config.complexCarbTime, 95) + fatDelay * 0.55, offset + Math.max(n(config.complexDuration, 240), n(config.complexCarbTime, 95) + 80) + fatDelay);
  addDistributedLoad(proteinRate, times, proteinLoad, offset + 60 + fatDelay * 0.35, offset + n(config.proteinTime, 240) + fatDelay * 0.75, offset + Math.max(n(config.proteinDuration, 360), extDur || n(config.proteinDuration, 360)));
  addDistributedLoad(fatRate, times, fatLoad, offset + 90, offset + n(config.fatTime, 320) + fatDelay, offset + Math.max(n(config.fatDuration, 480), (extDur ? extDur + 60 : n(config.fatDuration, 480)) + (fatG / 10) * 20));

  const basal = [];
  const simple = [];
  const complex = [];
  const protein = [];
  const fat = [];
  const totalNutrients = [];
  const glucoseNoIns = [];
  let simpleAcc = 0;
  let complexAcc = 0;
  let proteinAcc = 0;
  let fatAcc = 0;

  for (let index = 0; index < times.length; index += 1) {
    const minutesSinceStart = Math.max(0, times[index] + 30);
    const base = Math.max(floor, start - (n(config.basalDecayPerHour, 2.4) * (minutesSinceStart / 60)));
    simpleAcc += simpleRate[index];
    complexAcc += complexRate[index];
    proteinAcc += proteinRate[index];
    fatAcc += fatRate[index];
    const nutrients = simpleAcc + complexAcc + proteinAcc + fatAcc;
    basal.push(r1(base));
    simple.push(r1(simpleAcc));
    complex.push(r1(complexAcc));
    protein.push(r1(proteinAcc));
    fat.push(r1(fatAcc));
    totalNutrients.push(r1(nutrients));
    glucoseNoIns.push(r1(base + nutrients));
  }

  return {
    engineVersion: ENGINE_VERSION,
    labels,
    times,
    config,
    totals,
    basal,
    simple,
    complex,
    protein,
    fat,
    totalNutrients,
    glucoseNoIns,
    simpleRate,
    complexRate,
    proteinRate,
    fatRate,
    startGlucose: start,
    effISF: r1(effISF),
    conditionMultiplier: r2(multiplier),
    idealBand: idealBand(config)
  };
}

export function insulinActivityAt(minutesSinceDose, config = GLUCOSATRACK_ENGINE_DEFAULTS) {
  if (minutesSinceDose <= n(config.insulinOnset, 15) || minutesSinceDose >= n(config.insulinDuration, 240)) return 0;
  const activeMinutes = minutesSinceDose - n(config.insulinOnset, 15);
  const totalActive = Math.max(1, n(config.insulinDuration, 240) - n(config.insulinOnset, 15));
  const x = clamp(activeMinutes / totalActive, 0, 1);
  const peak = Math.max(n(config.insulinOnset, 15) + 10, n(config.insulinPeakTime, 75)) - n(config.insulinOnset, 15);
  const peakNorm = clamp(peak / totalActive, 0.08, 0.92);
  const leftPow = Math.max(1.2, peakNorm * 6);
  const rightPow = Math.max(1.2, (1 - peakNorm) * 6);
  const raw = Math.pow(x, leftPow) * Math.pow(1 - x, rightPow);
  const peakRaw = Math.pow(peakNorm, leftPow) * Math.pow(1 - peakNorm, rightPow);
  return peakRaw > 0 ? raw / peakRaw : 0;
}

export function buildInsulinRate(model, doses = []) {
  const config = model.config || GLUCOSATRACK_ENGINE_DEFAULTS;
  const effISF = Math.max(1, n(config.insulinSensitivity, 50) / Math.max(0.1, n(model.conditionMultiplier, 1)));
  const rate = new Array(model.times.length).fill(0);
  doses.forEach(dose => {
    addDistributedLoad(
      rate,
      model.times,
      Math.max(0, n(dose.units, 0)) * effISF,
      n(dose.time, -10) + n(config.insulinOnset, 15),
      n(dose.time, -10) + n(config.insulinPeakTime, 75),
      n(dose.time, -10) + n(config.insulinDuration, 240)
    );
  });
  return rate.map(r1);
}

export function buildInsulinActivity(model, doses = []) {
  const config = model.config || GLUCOSATRACK_ENGINE_DEFAULTS;
  return model.times.map(time => r2(doses.reduce((sum, dose) => sum + insulinActivityAt(time - n(dose.time, -10), config) * Math.max(0, n(dose.units, 0)), 0)));
}

export function buildGlucoseWithInsulin(model, doses = []) {
  if (!doses.length) return null;
  const config = model.config || GLUCOSATRACK_ENGINE_DEFAULTS;
  const target = idealTarget(config);
  const floor = Math.max(40, n(config.targetMin, 70) - 30);
  const correctionPool = Math.max(0, n(model.startGlucose, 100) - target);
  const rate = buildInsulinRate(model, doses);
  const glucose = [];
  const effect = [];
  const hypoDepth = [];
  let delivered = 0;

  for (let index = 0; index < model.times.length; index += 1) {
    delivered += rate[index];
    const availableLoad = model.totalNutrients[index] + correctionPool;
    const rawGlucose = model.basal[index] + model.totalNutrients[index] - delivered;
    const applied = Math.min(delivered, availableLoad);
    effect.push(r1(applied));
    hypoDepth.push(r1(Math.max(0, model.basal[index] - rawGlucose)));
    glucose.push(r1(Math.max(floor, rawGlucose)));
  }

  return { glucose, effect, rate, activity: buildInsulinActivity(model, doses), hypoDepth };
}

function roundDose(value, config) {
  const step = Math.max(n(config.doseMin, 0.1), n(config.doseRoundStep, 0.5));
  const rounded = r2(Math.round(n(value) / step) * step);
  return rounded <= 0 ? 0 : Math.max(n(config.doseMin, step), rounded);
}

function normalizeDose(dose, config) {
  return {
    ...dose,
    time: Math.round(n(dose.time, -10) / 5) * 5,
    units: roundDose(Math.max(0, n(dose.units, 0)), config),
    kind: dose.kind || "bolo"
  };
}

function isSlowMeal(warsaw, config) {
  return warsaw.fpUnits >= n(config.slowMealFpUnitsThreshold, 0.5)
    || warsaw.extendedMinutes >= n(config.slowMealExtendedMinutesThreshold, 240)
    || warsaw.totals.fats >= 12
    || warsaw.totals.proteins >= 25;
}

function chooseStrategy(requestedStrategy, warsaw, config) {
  const slowMeal = isSlowMeal(warsaw, config);
  if (!slowMeal) return requestedStrategy || "single";
  if (warsaw.fpUnits >= 1.5 || warsaw.extendedMinutes >= 300) return requestedStrategy === "single" ? "multi" : (requestedStrategy || "multi");
  return requestedStrategy === "single" ? "split" : (requestedStrategy || "split");
}

function buildCandidateDoses(strategy, warsaw, correctionUnits, config) {
  const carbUnits = warsaw.carbUnits;
  const fpUnits = warsaw.fpUnits;
  const extMin = warsaw.extendedMinutes;
  if (strategy === "single" || fpUnits < 0.35) {
    return [{ time: -10, units: carbUnits + fpUnits * 0.35 + correctionUnits * 0.7, kind: "bolo" }];
  }
  if (strategy === "split") {
    const first = carbUnits * 0.9 + correctionUnits * 0.65 + fpUnits * 0.18;
    const second = Math.max(0, carbUnits * 0.1 + fpUnits * 0.72 + correctionUnits * 0.15);
    return [
      { time: -10, units: first, kind: "bolo" },
      { time: Math.min(150, Math.max(60, Math.round((extMin || 240) * 0.38 / 5) * 5)), units: second, kind: "extendida" }
    ];
  }
  const first = carbUnits * 0.85 + correctionUnits * 0.6 + fpUnits * 0.12;
  const second = Math.max(0, carbUnits * 0.1 + fpUnits * 0.42 + correctionUnits * 0.1);
  const third = Math.max(0, carbUnits * 0.05 + fpUnits * 0.36);
  return [
    { time: -10, units: first, kind: "bolo" },
    { time: Math.min(150, Math.max(60, Math.round((extMin || 300) * 0.32 / 5) * 5)), units: second, kind: "extendida" },
    { time: Math.min(300, Math.max(135, Math.round((extMin || 300) * 0.72 / 5) * 5)), units: third, kind: "extendida" }
  ];
}

function capAndRoundDoses(doses, config) {
  let capped = doses
    .map(dose => normalizeDose({ ...dose, units: Math.min(n(config.maxAutoDosePerShot, 8), n(dose.units, 0)) }, config))
    .filter(dose => dose.units >= n(config.doseRoundStep, 0.5) / 2);
  const total = capped.reduce((sum, dose) => sum + n(dose.units, 0), 0);
  if (total > n(config.maxAutoTotalDose, 18) && total > 0) {
    const scale = n(config.maxAutoTotalDose, 18) / total;
    capped = capped
      .map(dose => normalizeDose({ ...dose, units: dose.units * scale }, config))
      .filter(dose => dose.units >= n(config.doseRoundStep, 0.5) / 2);
  }
  return capped;
}

function scaleDoses(doses, scale, config) {
  return doses
    .map(dose => normalizeDose({ ...dose, units: dose.units * scale }, config))
    .filter(dose => dose.units >= n(config.doseRoundStep, 0.5) / 2);
}

function curveSafety(model, withInsulin) {
  const band = model.idealBand || idealBand(model.config || GLUCOSATRACK_ENGINE_DEFAULTS);
  const values = withInsulin?.glucose || model.glucoseNoIns;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const below = Math.max(0, band.low - min);
  const above = Math.max(0, max - band.high);
  return {
    band,
    min: r1(min),
    max: r1(max),
    below: r1(below),
    above: r1(above),
    hasHypoRisk: below > 0
  };
}

function makeSafeDoses(model, doses, config) {
  let bestDoses = doses;
  let bestWithInsulin = buildGlucoseWithInsulin(model, bestDoses);
  let bestSafety = curveSafety(model, bestWithInsulin);
  if (!bestSafety.hasHypoRisk) return { doses: bestDoses, withInsulin: bestWithInsulin, safety: bestSafety, doseScale: 1 };

  for (let scale = 0.9; scale >= 0.25; scale -= 0.05) {
    const candidateDoses = scaleDoses(doses, scale, config);
    const candidateWithInsulin = buildGlucoseWithInsulin(model, candidateDoses);
    const candidateSafety = curveSafety(model, candidateWithInsulin);
    if (!candidateSafety.hasHypoRisk) {
      return { doses: candidateDoses, withInsulin: candidateWithInsulin, safety: candidateSafety, doseScale: r2(scale) };
    }
    if (candidateSafety.below < bestSafety.below) {
      bestDoses = candidateDoses;
      bestWithInsulin = candidateWithInsulin;
      bestSafety = candidateSafety;
    }
  }
  return { doses: bestDoses, withInsulin: bestWithInsulin, safety: bestSafety, doseScale: null };
}

export function recommendInsulin(input) {
  const plan = optimizeInsulinPlan(input, "auto");
  return Math.max(0, r2(plan.totalUnits));
}

export function optimizeInsulinPlan(input, strategy = "split") {
  const config = normalizeConfig(input);
  const warsaw = getWarsawMealData(input);
  const band = idealBand(config);
  const correctionUnits = Math.max(0, startGlucose(input, config) - band.high) / Math.max(1, warsaw.effISF);
  const requestedStrategy = strategy === "auto" ? "split" : strategy;
  const appliedStrategy = chooseStrategy(requestedStrategy, warsaw, config);
  const model = buildGlucosaTrackMetabolicModel(input);
  const rawDoses = buildCandidateDoses(appliedStrategy, warsaw, correctionUnits, config);
  const cappedDoses = capAndRoundDoses(rawDoses, config);
  const safePlan = makeSafeDoses(model, cappedDoses, config);

  return {
    strategy: appliedStrategy,
    requestedStrategy,
    strategyAdjusted: appliedStrategy !== requestedStrategy,
    slowMeal: isSlowMeal(warsaw, config),
    warsaw,
    correctionUnits: r2(correctionUnits),
    idealBand: band,
    safety: safePlan.safety,
    doseScale: safePlan.doseScale,
    doses: safePlan.doses,
    totalUnits: r2(safePlan.doses.reduce((sum, dose) => sum + n(dose.units, 0), 0)),
    model,
    withInsulin: safePlan.withInsulin
  };
}

export function buildGlucosaTrackSimulation(input, options = {}) {
  const strategy = options.strategy || "split";
  const optimizedPlan = optimizeInsulinPlan(input, strategy);
  const model = optimizedPlan.model;
  const withInsulin = optimizedPlan.withInsulin;
  const recommendedUnits = Math.max(0, r2(optimizedPlan.totalUnits));
  return {
    engineVersion: ENGINE_VERSION,
    model,
    warsaw: optimizedPlan.warsaw,
    recommendedUnits,
    optimizedPlan,
    withInsulin,
    peaks: {
      withoutInsulin: Math.max(...model.glucoseNoIns),
      withInsulin: withInsulin ? Math.max(...withInsulin.glucose) : null,
      basal: Math.max(...model.basal)
    },
    mins: {
      withoutInsulin: Math.min(...model.glucoseNoIns),
      withInsulin: withInsulin ? Math.min(...withInsulin.glucose) : null,
      basal: Math.min(...model.basal)
    }
  };
}
