export const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const VALID_UNITS = ["g", "kg", "ml", "l", "unidades"];
export const STORAGE_TYPES = ["pantry", "fridge", "freezer"];
export const DATE_TYPES = ["expiry", "bestBefore", "none"];

export function uid(prefix = "id") {
  const random = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

export function nowIso() { return new Date().toISOString(); }
export function todayIsoDate() { return new Date().toISOString().slice(0, 10); }

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function stripDangerousText(value = "") {
  return String(value)
    .replace(/<\s*script/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export function normalizeUnit(unit) {
  const u = String(unit || "").trim().toLowerCase();
  if (["kg", "kilo", "kilos"].includes(u)) return "kg";
  if (["g", "gr", "gramo", "gramos"].includes(u)) return "g";
  if (["l", "litro", "litros"].includes(u)) return "l";
  if (["ml", "mililitro", "mililitros"].includes(u)) return "ml";
  if (["unidad", "unidades", "ud", "uds", "u"].includes(u)) return "unidades";
  return u;
}

export function toBaseQty(qty, unit) {
  const amount = Number(qty) || 0;
  const normalized = normalizeUnit(unit);
  if (normalized === "kg") return { qty: amount * 1000, unit: "g" };
  if (normalized === "g") return { qty: amount, unit: "g" };
  if (normalized === "l") return { qty: amount * 1000, unit: "ml" };
  if (normalized === "ml") return { qty: amount, unit: "ml" };
  if (normalized === "unidades") return { qty: amount, unit: "unidades" };
  return { qty: amount, unit: normalized };
}

export function areCompatibleUnits(a, b) {
  return toBaseQty(1, a).unit === toBaseQty(1, b).unit;
}

export function formatQty(qty, unit) {
  const rounded = Math.round((Number(qty) || 0) * 100) / 100;
  return `${rounded.toLocaleString("es-ES")} ${normalizeUnit(unit)}`;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
}

export function parseNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function downloadTextFile(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readFileAsText(file, maxBytes = 2_000_000) {
  if (!file) throw new Error("No se ha seleccionado archivo.");
  if (file.size > maxBytes) throw new Error("El archivo es demasiado grande.");
  return await file.text();
}

export function safeJsonParse(text) {
  if (/javascript:|<\s*script/gi.test(text)) throw new Error("El JSON contiene texto potencialmente inseguro.");
  return JSON.parse(text);
}
