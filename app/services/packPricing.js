import { normalizeUnit } from "../utils.js";

const UNIT_BASE = Object.freeze({
  g: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 },
  unidades: { unit: "unidades", factor: 1 }
});

export function collectCanonicalDishRequirements(dish, ingredientsById) {
  const lookup = ingredientsById instanceof Map
    ? ingredientsById
    : new Map((ingredientsById || []).map(ingredient => [ingredient.id, ingredient]));
  const requirements = [];

  for (const line of dish?.recipe || []) {
    const ingredient = lookup.get(line.ingredientId);
    const canonicalIngredientId = String(ingredient?.canonicalIngredientId || "").trim();
    if (!canonicalIngredientId) continue;
    const normalized = normalizeRequirementQuantity(line.qty, line.unit);
    if (!normalized) continue;
    requirements.push({
      canonicalIngredientId,
      canonicalIngredientName: String(ingredient.canonicalIngredientName || ingredient.name || canonicalIngredientId).trim(),
      amount: roundQuantity(normalized.amount),
      unit: normalized.unit
    });
  }

  return requirements;
}

export function collectCanonicalPackRequirements(pack, selectedDishIds = null) {
  const ingredientsById = new Map((pack?.ingredients || []).map(ingredient => [ingredient.id, ingredient]));
  const selected = selectedDishIds ? new Set(selectedDishIds) : null;
  const totals = new Map();

  for (const dish of pack?.dishes || []) {
    if (selected && !selected.has(dish.id)) continue;
    for (const requirement of collectCanonicalDishRequirements(dish, ingredientsById)) {
      const key = `${requirement.canonicalIngredientId}|${requirement.unit}`;
      const current = totals.get(key) || { ...requirement, amount: 0 };
      current.amount += requirement.amount;
      totals.set(key, current);
    }
  }

  return [...totals.values()]
    .map(item => ({ ...item, amount: roundQuantity(item.amount) }))
    .filter(item => item.amount > 0)
    .sort((a, b) => a.canonicalIngredientName.localeCompare(b.canonicalIngredientName, "es"));
}

export function normalizeRequirementQuantity(amount, unit) {
  const qty = Number(amount);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const normalizedUnit = normalizeUnit(unit || "");
  const conversion = UNIT_BASE[normalizedUnit];
  if (!conversion) return null;
  return {
    amount: qty * conversion.factor,
    unit: conversion.unit
  };
}

function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}
