import { getState } from "../store.js";
import { computeDishNutrition } from "./nutritionCalculator.js";
import { buildAbsorptionCurve, estimateGlycemicImpactFromNutrition } from "./glycemicCalculator.js";

export const GLUCOSATRACK_ADAPTER_VERSION = 1;

export const DEFAULT_GLUCOSE_PROFILE = {
  enabled: false,
  diabetes: false,
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

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeMetabolicSettings(member = {}) {
  const settings = { ...DEFAULT_GLUCOSE_PROFILE, ...(member.metabolicSettings || {}) };
  return {
    ...settings,
    enabled: Boolean(settings.enabled),
    diabetes: Boolean(settings.diabetes),
    baseGlucose: safeNumber(settings.baseGlucose, DEFAULT_GLUCOSE_PROFILE.baseGlucose),
    carbRatio: safeNumber(settings.carbRatio, DEFAULT_GLUCOSE_PROFILE.carbRatio),
    insulinSensitivity: safeNumber(settings.insulinSensitivity, DEFAULT_GLUCOSE_PROFILE.insulinSensitivity),
    targetMin: safeNumber(settings.targetMin, DEFAULT_GLUCOSE_PROFILE.targetMin),
    targetMax: safeNumber(settings.targetMax, DEFAULT_GLUCOSE_PROFILE.targetMax),
    insulinOnset: safeNumber(settings.insulinOnset, DEFAULT_GLUCOSE_PROFILE.insulinOnset),
    insulinPeakTime: safeNumber(settings.insulinPeakTime, DEFAULT_GLUCOSE_PROFILE.insulinPeakTime),
    insulinDuration: safeNumber(settings.insulinDuration, DEFAULT_GLUCOSE_PROFILE.insulinDuration),
    simpleSugarTime: safeNumber(settings.simpleSugarTime, DEFAULT_GLUCOSE_PROFILE.simpleSugarTime),
    complexCarbTime: safeNumber(settings.complexCarbTime, DEFAULT_GLUCOSE_PROFILE.complexCarbTime),
    proteinTime: safeNumber(settings.proteinTime, DEFAULT_GLUCOSE_PROFILE.proteinTime),
    fatTime: safeNumber(settings.fatTime, DEFAULT_GLUCOSE_PROFILE.fatTime),
    sickMultiplier: safeNumber(settings.sickMultiplier, DEFAULT_GLUCOSE_PROFILE.sickMultiplier),
    menstruationMultiplier: safeNumber(settings.menstruationMultiplier, DEFAULT_GLUCOSE_PROFILE.menstruationMultiplier)
  };
}

function getDishById(state, dishId) {
  return state.dishes.find(dish => dish.id === dishId) || null;
}

function getMemberById(state, memberId) {
  return state.familyMembers.find(member => member.id === memberId) || state.familyMembers[0] || null;
}

export function getGlucosaTrackPlannerSnapshot(state = getState()) {
  return {
    adapterVersion: GLUCOSATRACK_ADAPTER_VERSION,
    source: "Gestor-Almentacion",
    activeWeekId: state.activeWeekId,
    members: state.familyMembers.map(member => ({
      id: member.id,
      name: member.name,
      metabolicSettings: normalizeMetabolicSettings(member)
    })),
    dishes: state.dishes.map(dish => ({
      id: dish.id,
      name: dish.name,
      description: dish.description || "",
      servings: dish.servings || 1,
      tags: dish.tags || [],
      ingredientLines: dish.ingredients || []
    })),
    weeks: state.weeks.map(week => ({
      id: week.id,
      name: week.name,
      startDate: week.startDate,
      plan: week.plan || {}
    }))
  };
}

export function buildGlucosaTrackMealInput({ state = getState(), dishId, memberId, currentGlucose, mealOffset = 0, conditions = {} } = {}) {
  const dish = getDishById(state, dishId);
  const member = getMemberById(state, memberId);
  if (!dish) throw new Error("No se ha encontrado el plato solicitado para GlucosaTrack.");
  if (!member) throw new Error("No hay miembros familiares disponibles para GlucosaTrack.");

  const metabolicSettings = normalizeMetabolicSettings(member);
  const nutrition = computeDishNutrition(state, dish.id);
  const impact = estimateGlycemicImpactFromNutrition(nutrition.total, metabolicSettings);
  const curve = buildAbsorptionCurve(nutrition.total, metabolicSettings);

  return {
    adapterVersion: GLUCOSATRACK_ADAPTER_VERSION,
    source: "Gestor-Almentacion",
    dish: {
      id: dish.id,
      name: dish.name,
      servings: dish.servings || 1
    },
    member: {
      id: member.id,
      name: member.name,
      metabolicSettings
    },
    glucoseContext: {
      currentGlucose: currentGlucose === undefined || currentGlucose === "" ? metabolicSettings.baseGlucose : safeNumber(currentGlucose, metabolicSettings.baseGlucose),
      mealOffset: safeNumber(mealOffset, 0),
      conditions: {
        sick: Boolean(conditions.sick),
        menstruation: Boolean(conditions.menstruation)
      }
    },
    nutrition,
    glycemic: {
      impact,
      curve
    }
  };
}

export function buildGlucosaTrackInputsForWeek({ state = getState(), weekId = state.activeWeekId } = {}) {
  const week = state.weeks.find(item => item.id === weekId);
  if (!week) return [];

  return Object.entries(week.plan || {}).flatMap(([slot, dishIds]) => {
    const [dayId, mealTypeId, memberId] = slot.split("__");
    return (dishIds || []).map(dishId => ({
      slot,
      dayId,
      mealTypeId,
      memberId,
      dishId,
      input: buildGlucosaTrackMealInput({ state, dishId, memberId })
    }));
  });
}
