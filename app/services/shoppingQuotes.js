const BLOCKED_QUOTE_STATUSES = new Set(["loading", "loaded", "unconfigured", "error"]);

export function canStartShoppingQuote(status) {
  return !BLOCKED_QUOTE_STATUSES.has(String(status || "").trim().toLowerCase());
}

export function pickBestShoppingQuote(items = []) {
  const candidates = (Array.isArray(items) ? items : [])
    .filter(item => item?.product && item.product.available !== false && Number(item.totalCost) > 0);
  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const costDiff = Number(a.totalCost) - Number(b.totalCost);
    if (costDiff) return costDiff;
    const packageDiff = Number(a.packageCount || 0) - Number(b.packageCount || 0);
    if (packageDiff) return packageDiff;
    return String(a.product.name || "").localeCompare(String(b.product.name || ""), "es");
  })[0];
}

export function summarizeShoppingQuote(quote) {
  const product = quote?.product;
  if (!product) return null;
  const packageCount = Number(quote.packageCount || 0);
  const packagePrice = Number(product.price || 0);
  const totalCost = Number(quote.totalCost || 0);
  const approximate = quote.approximate === true || product.variableWeight === true;
  if (!(totalCost > 0)) return null;
  if (!approximate && (!(packageCount > 0) || !(packagePrice > 0))) return null;

  return {
    productName: String(product.name || "Producto supermercado"),
    supermarket: String(product.supermarketId || "supermercado").toUpperCase(),
    packageCount,
    packagePrice,
    totalCost,
    purchasedAmount: Number(quote.purchasedAmount || 0),
    purchasedUnit: String(quote.purchasedUnit || ""),
    wasteAmount: Number(quote.wasteAmount || 0),
    approximate,
    pricePerUnit: Number(product.pricePerUnit || 0),
    priceUnit: String(product.priceUnit || "")
  };
}
