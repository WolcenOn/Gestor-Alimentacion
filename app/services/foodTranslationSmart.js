import { translateFoodQueryToEnglish as translateBaseFoodQueryToEnglish } from "./foodTranslation.js";

const PREPARATION_PHRASES = [
  { pattern: /\ba la plancha\b/g, value: "grilled" },
  { pattern: /\bal carbon\b/g, value: "charcoal grilled" },
  { pattern: /\ba la brasa\b/g, value: "charcoal grilled" },
  { pattern: /\ba la parrilla\b/g, value: "grilled" },
  { pattern: /\ba la barbacoa\b/g, value: "barbecued" },
  { pattern: /\bal horno\b/g, value: "baked" },
  { pattern: /\bal vapor\b/g, value: "steamed" },
  { pattern: /\bsalteado\b/g, value: "sauteed" },
  { pattern: /\bsalteada\b/g, value: "sauteed" },
  { pattern: /\bguisado\b/g, value: "stewed" },
  { pattern: /\bguisada\b/g, value: "stewed" },
  { pattern: /\bestofado\b/g, value: "stewed" },
  { pattern: /\bestofada\b/g, value: "stewed" },
  { pattern: /\brebozado\b/g, value: "breaded" },
  { pattern: /\brebozada\b/g, value: "breaded" },
  { pattern: /\bempanado\b/g, value: "breaded" },
  { pattern: /\bempanada\b/g, value: "breaded" }
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPreparationPhrase(query) {
  let foodQuery = normalizeText(query);
  const preparations = [];
  for (const item of PREPARATION_PHRASES) {
    if (!item.pattern.test(foodQuery)) continue;
    item.pattern.lastIndex = 0;
    foodQuery = foodQuery.replace(item.pattern, " ");
    if (!preparations.includes(item.value)) preparations.push(item.value);
  }
  return {
    foodQuery: foodQuery.replace(/\s+/g, " ").trim(),
    preparations
  };
}

function smartTranslateCookedPhrase(query) {
  const normalized = normalizeText(query);
  const { foodQuery, preparations } = extractPreparationPhrase(normalized);
  if (!preparations.length || !foodQuery) return null;

  const base = translateBaseFoodQueryToEnglish(foodQuery);
  const translatedQuery = [...preparations, base.query].join(" ").replace(/\s+/g, " ").trim();
  return {
    query: translatedQuery,
    translated: true,
    original: query
  };
}

export function translateFoodQueryToEnglish(query) {
  const cookedPhrase = smartTranslateCookedPhrase(query);
  if (cookedPhrase) return cookedPhrase;
  return translateBaseFoodQueryToEnglish(query);
}

export { getKnownFoodTranslations } from "./foodTranslation.js";
