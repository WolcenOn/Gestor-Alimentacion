export const COVERAGE_STATUS = Object.freeze({
  CANONICAL_EXACT: "canonical_exact",
  VERIFIED_ALIAS: "verified_alias",
  SUGGESTED_ALIAS: "suggested_alias",
  AMBIGUOUS: "ambiguous",
  UNRESOLVED: "unresolved"
});

export function normalizeCoverageKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function baseManifestEntries(manifest) {
  if (!Array.isArray(manifest)) throw new Error("packs/manifest.json debe contener un array.");
  return manifest.filter(entry => {
    const packPath = String(entry?.path || "").trim().replace(/^\.\//, "");
    return packPath.endsWith(".json") && !entry?.canonicalReady && !packPath.startsWith("packs/canonical/");
  });
}

export function collectPackOccurrences(pack, source = "") {
  const ingredientNames = new Map(
    (Array.isArray(pack?.ingredients) ? pack.ingredients : [])
      .filter(item => String(item?.id || "").trim() && String(item?.name || "").trim())
      .map(item => [String(item.id), String(item.name).trim()])
  );

  const occurrences = [];
  for (const dish of Array.isArray(pack?.dishes) ? pack.dishes : []) {
    for (const line of Array.isArray(dish?.recipe) ? dish.recipe : []) {
      const name = ingredientNames.get(String(line?.ingredientId || ""));
      if (!name) continue;
      occurrences.push({
        name,
        source: [source, String(dish?.id || dish?.name || "").trim()].filter(Boolean).join("#")
      });
    }
  }
  return occurrences;
}

export function aggregateCoverageOccurrences(occurrences = []) {
  const aggregate = new Map();
  for (const occurrence of Array.isArray(occurrences) ? occurrences : []) {
    const name = String(occurrence?.name || "").trim();
    const key = normalizeCoverageKey(name);
    if (!key) continue;
    const current = aggregate.get(key) || { name, count: 0, sources: new Set() };
    current.count += 1;
    if (occurrence?.source) current.sources.add(String(occurrence.source));
    aggregate.set(key, current);
  }
  return [...aggregate.values()]
    .map(item => ({ name: item.name, count: item.count, sources: [...item.sources].sort() }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

export function classifyCanonicalResolution(input, resolution = {}) {
  const candidates = Array.isArray(resolution?.candidates) ? resolution.candidates : [];
  const item = {
    name: input.name,
    count: Number(input.count || 0),
    sources: Array.isArray(input.sources) ? input.sources : [],
    normalized: String(resolution?.normalizedQuery || ""),
    status: COVERAGE_STATUS.UNRESOLVED,
    candidates
  };
  if (!candidates.length) return item;

  if (resolution.status === "verified") {
    if (candidates.length !== 1) return { ...item, status: COVERAGE_STATUS.AMBIGUOUS };
    const candidate = candidates[0];
    return {
      ...item,
      status: candidate.matchType === "canonical_name" ? COVERAGE_STATUS.CANONICAL_EXACT : COVERAGE_STATUS.VERIFIED_ALIAS,
      canonicalId: candidate?.ingredient?.id || "",
      canonicalName: candidate?.ingredient?.name || "",
      confidence: Number(candidate?.confidence || 0)
    };
  }

  if (resolution.status === "suggested") {
    if (candidates.length !== 1) return { ...item, status: COVERAGE_STATUS.AMBIGUOUS };
    const candidate = candidates[0];
    return {
      ...item,
      status: COVERAGE_STATUS.SUGGESTED_ALIAS,
      canonicalId: candidate?.ingredient?.id || "",
      canonicalName: candidate?.ingredient?.name || "",
      confidence: Number(candidate?.confidence || 0)
    };
  }
  return item;
}

function statusRank(status) {
  return {
    [COVERAGE_STATUS.UNRESOLVED]: 0,
    [COVERAGE_STATUS.AMBIGUOUS]: 1,
    [COVERAGE_STATUS.SUGGESTED_ALIAS]: 2,
    [COVERAGE_STATUS.VERIFIED_ALIAS]: 3,
    [COVERAGE_STATUS.CANONICAL_EXACT]: 4
  }[status] ?? 9;
}

export function buildCoverageReport(inputs = [], resolutions = []) {
  const items = inputs.map((input, index) => classifyCanonicalResolution(input, resolutions[index] || {}));
  const summary = {
    uniqueIngredients: items.length,
    totalOccurrences: 0,
    resolvedUnique: 0,
    resolvedOccurrences: 0,
    canonicalExact: 0,
    verifiedAlias: 0,
    suggestedAlias: 0,
    ambiguous: 0,
    unresolved: 0,
    coverageUnique: 0,
    coverageOccurrences: 0
  };

  for (const item of items) {
    summary.totalOccurrences += item.count;
    if (item.status === COVERAGE_STATUS.CANONICAL_EXACT) {
      summary.canonicalExact += 1;
      summary.resolvedUnique += 1;
      summary.resolvedOccurrences += item.count;
    } else if (item.status === COVERAGE_STATUS.VERIFIED_ALIAS) {
      summary.verifiedAlias += 1;
      summary.resolvedUnique += 1;
      summary.resolvedOccurrences += item.count;
    } else if (item.status === COVERAGE_STATUS.SUGGESTED_ALIAS) summary.suggestedAlias += 1;
    else if (item.status === COVERAGE_STATUS.AMBIGUOUS) summary.ambiguous += 1;
    else summary.unresolved += 1;
  }

  if (summary.uniqueIngredients) summary.coverageUnique = summary.resolvedUnique / summary.uniqueIngredients;
  if (summary.totalOccurrences) summary.coverageOccurrences = summary.resolvedOccurrences / summary.totalOccurrences;

  items.sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.count - a.count || a.name.localeCompare(b.name, "es"));
  return { summary, items };
}
