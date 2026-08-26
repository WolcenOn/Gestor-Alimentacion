import { normalizeRequirementQuantity } from "./packPricing.js";

export function ingredientConsumedCost(requirement, product) {
  const normalized = normalizeRequirementQuantity(requirement?.amount, requirement?.unit);
  if (!normalized || !product) return null;
  const pricePerUnit = Number(product.pricePerUnit || 0);
  const priceUnit = String(product.priceUnit || "").trim().toLowerCase();
  if (!(pricePerUnit > 0) || !priceUnit) return null;

  let pricedAmount;
  if (normalized.unit === "g" && priceUnit === "kg") pricedAmount = normalized.amount / 1000;
  else if (normalized.unit === "g" && priceUnit === "g") pricedAmount = normalized.amount;
  else if (normalized.unit === "ml" && priceUnit === "l") pricedAmount = normalized.amount / 1000;
  else if (normalized.unit === "ml" && priceUnit === "ml") pricedAmount = normalized.amount;
  else if (normalized.unit === "unidades" && ["unidad", "unidades", "ud"].includes(priceUnit)) pricedAmount = normalized.amount;
  else return null;

  return roundMoney(pricedAmount * pricePerUnit);
}

export function summarizeDishConsumedCost(requirements = [], productsByCanonical = new Map(), totalRecipeLines = null) {
  let totalCost = 0;
  let pricedIngredients = 0;
  const canonicalRequirements = Array.isArray(requirements) ? requirements : [];

  for (const requirement of canonicalRequirements) {
    const product = productsByCanonical.get(requirement.canonicalIngredientId);
    const cost = ingredientConsumedCost(requirement, product);
    if (cost == null) continue;
    totalCost += cost;
    pricedIngredients += 1;
  }

  const totalIngredients = Number.isFinite(Number(totalRecipeLines))
    ? Number(totalRecipeLines)
    : canonicalRequirements.length;

  return {
    totalCost: roundMoney(totalCost),
    pricedIngredients,
    canonicalIngredients: canonicalRequirements.length,
    totalIngredients,
    complete: totalIngredients > 0 && pricedIngredients === totalIngredients
  };
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
