// Privacy-preserving preview: compare structures by stable IDs without returning
// personal names, nutrition/health contents, or other field values to the UI.
const COLLECTIONS = Object.freeze({
  ingredientFamilies:"Familias de ingredientes",
  ingredients:"Ingredientes",
  dishes:"Platos y recetas",
  dishPacks:"Packs",
  weeks:"Semanas y menús",
  familyMembers:"Miembros del hogar",
  mealTypes:"Tipos de comida",
  purchaseLots:"Lotes de compra",
  purchaseEntries:"Compras",
  directPurchaseItems:"Compras directas",
  wasteEntries:"Desperdicio",
  recyclingEntries:"Reciclaje",
  nutritionProfiles:"Perfiles nutricionales",
  historySnapshots:"Historial"
});

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function keyed(items) {
  return new Map(items.map((item, index) => [String(item?.id ?? `index:${index}`), stableStringify(item)]));
}

export function compareCloudStates(local = {}, remote = {}) {
  const differences = [];
  for (const [key, label] of Object.entries(COLLECTIONS)) {
    const localItems = Array.isArray(local?.[key]) ? local[key] : [];
    const remoteItems = Array.isArray(remote?.[key]) ? remote[key] : [];
    const localMap = keyed(localItems);
    const remoteMap = keyed(remoteItems);
    const onlyLocal = [...localMap.keys()].filter(id => !remoteMap.has(id)).length;
    const onlyRemote = [...remoteMap.keys()].filter(id => !localMap.has(id)).length;
    const different = [...localMap.keys()]
      .filter(id => remoteMap.has(id) && localMap.get(id) !== remoteMap.get(id)).length;
    if (onlyLocal || onlyRemote || different) {
      differences.push({
        key, label, localCount:localItems.length, remoteCount:remoteItems.length,
        onlyLocal, onlyRemote, different
      });
    }
  }
  // Non-collection settings can also differ; do not display their values.
  const otherKeys = new Set([
    ...Object.keys(local || {}), ...Object.keys(remote || {})
  ]);
  for (const key of Object.keys(COLLECTIONS)) otherKeys.delete(key);
  otherKeys.delete("meta"); // Migration timestamps are not planning differences.
  const differentSettings = [...otherKeys]
    .filter(key => stableStringify(local?.[key]) !== stableStringify(remote?.[key]));
  return {
    differences,
    otherSettingsChanged:differentSettings.length,
    hasDifferences:Boolean(differences.length || differentSettings.length)
  };
}

export function cloudConflictReviewText(review) {
  const lines = [
    "Comparación de datos locales y nube (no se ha sustituido ningún dato).",
    `Versión conocida: ${review.knownUpdatedAt || "sin sincronización previa"}`,
    `Versión actual nube: ${review.remoteUpdatedAt || "sin snapshot"}`,
    review.pendingLocalChanges ? "Hay cambios locales pendientes." : "No hay cambios locales marcados como pendientes."
  ];
  if (!review.hasDifferences) lines.push("No se aprecian diferencias en los datos comparados.");
  for (const row of review.differences) {
    lines.push(`${row.label}: local ${row.localCount}, nube ${row.remoteCount}; solo local ${row.onlyLocal}, solo nube ${row.onlyRemote}, modificados ${row.different}.`);
  }
  if (review.otherSettingsChanged) lines.push(`Otros apartados de configuración distintos: ${review.otherSettingsChanged}.`);
  lines.push("Esta comparación es orientativa, no fusiona versiones ni sustituye una copia de seguridad.");
  return lines.join("\n");
}
