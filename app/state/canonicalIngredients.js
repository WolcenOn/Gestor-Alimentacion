export const CANONICAL_MATCH_STATUS = Object.freeze({
  UNLINKED: "unlinked",
  SUGGESTED: "suggested",
  CONFIRMED: "confirmed"
});

export function getIngredientCanonicalId(ingredient) {
  return String(ingredient?.canonicalIngredientId || "").trim();
}

export function findIngredientByCanonicalId(state, canonicalIngredientId) {
  const target = String(canonicalIngredientId || "").trim();
  if (!target) return null;
  return (state?.ingredients || []).find(ingredient => getIngredientCanonicalId(ingredient) === target) || null;
}

export function withCanonicalIngredientLink(ingredient, link = {}) {
  return {
    ...ingredient,
    canonicalIngredientId: String(link.id || link.canonicalIngredientId || ingredient?.canonicalIngredientId || "").trim(),
    canonicalIngredientName: String(link.name || link.canonicalIngredientName || ingredient?.canonicalIngredientName || "").trim(),
    canonicalMatchStatus: normalizeCanonicalMatchStatus(link.status || link.canonicalMatchStatus || ingredient?.canonicalMatchStatus)
  };
}

export function normalizeCanonicalMatchStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (Object.values(CANONICAL_MATCH_STATUS).includes(status)) return status;
  return CANONICAL_MATCH_STATUS.UNLINKED;
}
