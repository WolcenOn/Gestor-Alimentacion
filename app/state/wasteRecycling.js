import { uid, nowIso, toBaseQty, normalizeUnit } from "../utils.js";
import { validateNoDangerousText } from "../validation.js";

export const PACKAGING_TYPES = ["plástico", "cartón/papel", "vidrio", "metal", "brik", "orgánico", "otro"];

export function registerWaste(state, input) {
  const ingredient = state.ingredients.find(i => i.id === input.ingredientId);
  if (!ingredient) throw new Error("Ingrediente no encontrado.");
  const wasted = toBaseQty(input.qty, input.unit || ingredient.unit);
  if (wasted.qty <= 0) throw new Error("La cantidad tirada debe ser mayor que cero.");
  const stock = toBaseQty(ingredient.qty, ingredient.unit);
  if (stock.unit !== wasted.unit) throw new Error("No se pueden restar unidades incompatibles.");
  validateNoDangerousText(input.reason || "", "Motivo de desperdicio");

  const finalQty = Math.max(0, stock.qty - wasted.qty);
  ingredient.qty = finalQty;
  ingredient.unit = stock.unit;
  ingredient.available = finalQty > 0;
  ingredient.updatedAt = nowIso();

  state.wasteEntries ||= [];
  state.wasteEntries.push({
    id: uid("waste"),
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    qty: wasted.qty,
    unit: wasted.unit,
    reason: String(input.reason || "").trim(),
    estimatedValue: Number(input.estimatedValue) || (wasted.qty * (Number(ingredient.approxPrice) || 0)),
    date: input.date || new Date().toISOString().slice(0, 10),
    createdAt: nowIso(),
    schemaVersion: 1
  });
}

export function registerRecycling(state, input) {
  const type = String(input.packagingType || "otro").trim();
  if (!PACKAGING_TYPES.includes(type)) throw new Error("Tipo de envase no válido.");
  const qty = Number(input.packagingQty) || 0;
  if (qty <= 0) return;
  validateNoDangerousText(input.notes || "", "Notas de reciclaje");
  state.recyclingEntries ||= [];
  state.recyclingEntries.push({
    id: uid("recycling"),
    type,
    qty,
    source: input.source || "manual",
    ingredientId: input.ingredientId || "",
    ingredientName: input.ingredientName || "",
    date: input.date || new Date().toISOString().slice(0, 10),
    notes: String(input.notes || "").trim(),
    createdAt: nowIso(),
    schemaVersion: 1
  });
}

export function getWasteScore(state) {
  const purchasedValue = (state.purchaseEntries || []).reduce((sum, e) => sum + (Number(e.price) || 0), 0);
  const wastedValue = (state.wasteEntries || []).reduce((sum, e) => sum + (Number(e.estimatedValue) || 0), 0);
  if (purchasedValue <= 0 && wastedValue <= 0) return { score: 100, purchasedValue, wastedValue, ratio: 0 };
  const ratio = purchasedValue > 0 ? wastedValue / purchasedValue : 1;
  const score = Math.max(0, Math.round(100 - ratio * 100));
  return { score, purchasedValue, wastedValue, ratio };
}

export function getRecyclingSummary(state) {
  return (state.recyclingEntries || []).reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + (Number(e.qty) || 0);
    return acc;
  }, {});
}

export function normalizePackagingType(value = "") {
  const v = String(value).toLowerCase();
  if (v.includes("plástico") || v.includes("plastic")) return "plástico";
  if (v.includes("cart") || v.includes("paper") || v.includes("papel")) return "cartón/papel";
  if (v.includes("vidrio") || v.includes("glass")) return "vidrio";
  if (v.includes("metal") || v.includes("alumin")) return "metal";
  if (v.includes("brik") || v.includes("brick")) return "brik";
  return "otro";
}
