export function directPurchasesForWeek(state, weekId = state?.activeWeekId) {
  return (state?.directPurchaseItems || []).filter(item => item.weekId === weekId);
}

export function addDirectPurchase(state, { product, quantity = 1, weekId = state?.activeWeekId } = {}) {
  if (!state || !product || !weekId) throw new Error("Faltan datos para añadir el producto a la compra.");
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("La cantidad debe ser un número entero mayor que cero.");
  const productId = String(product.id || "").trim();
  if (!productId) throw new Error("El producto no tiene identificador.");
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) throw new Error("El producto no tiene un precio válido.");

  state.directPurchaseItems ||= [];
  const existing = state.directPurchaseItems.find(item => item.weekId === weekId && item.productId === productId);
  if (existing) {
    existing.quantity += qty;
    existing.price = price;
    existing.available = product.available !== false;
    existing.observedAt = product.observedAt || existing.observedAt || "";
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const stamp = new Date().toISOString();
  const item = {
    id: `direct_${weekId}_${productId}`,
    weekId,
    productId,
    supermarketId: String(product.supermarketId || ""),
    externalId: String(product.externalId || ""),
    name: String(product.name || "Producto"),
    brand: String(product.brand || ""),
    packageAmount: Number(product.packageAmount) || 0,
    packageUnit: String(product.packageUnit || ""),
    price,
    pricePerUnit: Number(product.pricePerUnit) || 0,
    priceUnit: String(product.priceUnit || ""),
    sourceUrl: String(product.sourceUrl || ""),
    available: product.available !== false,
    observedAt: String(product.observedAt || ""),
    quantity: qty,
    createdAt: stamp,
    updatedAt: stamp
  };
  state.directPurchaseItems.push(item);
  return item;
}

export function setDirectPurchaseQuantity(state, itemId, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("La cantidad debe ser un número entero mayor que cero.");
  const item = (state?.directPurchaseItems || []).find(entry => entry.id === itemId);
  if (!item) throw new Error("Producto de compra directa no encontrado.");
  item.quantity = qty;
  item.updatedAt = new Date().toISOString();
  return item;
}

export function removeDirectPurchase(state, itemId) {
  if (!state?.directPurchaseItems) return;
  state.directPurchaseItems = state.directPurchaseItems.filter(item => item.id !== itemId);
}

export function directPurchaseSubtotal(state, weekId = state?.activeWeekId) {
  return directPurchasesForWeek(state, weekId).reduce((total, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return total + price * quantity;
  }, 0);
}
