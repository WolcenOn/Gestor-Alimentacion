export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value) {
  if (!ISO_DATE_RE.test(String(value || ""))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function todayLocalDate() {
  return new Date();
}

export function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay() || 7;
  return addDays(base, 1 - day);
}

export function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

export function getWeekRange(date = todayLocalDate()) {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  return {
    start,
    end,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    id: `week_${toIsoDate(start).replaceAll("-", "_")}`,
    name: `Semana ${formatShortDate(start)}-${formatShortDate(end)}`
  };
}

export function getMonthKey(date = todayLocalDate()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return getMonthKey(todayLocalDate());
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function addMonths(monthKey, offset) {
  const [year, month] = parseMonthKey(monthKey).split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return getMonthKey(date);
}

export function monthLabel(monthKey) {
  const [year, month] = parseMonthKey(monthKey).split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function buildMonthWeeks(monthKey) {
  const [year, month] = parseMonthKey(monthKey).split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstWeekStart = startOfWeek(first);
  const weeks = [];

  for (let start = firstWeekStart; start <= last; start = addDays(start, 7)) {
    const range = getWeekRange(start);
    weeks.push({
      ...range,
      days: Array.from({ length: 7 }, (_, index) => addDays(range.start, index)).map(day => ({
        date: day,
        iso: toIsoDate(day),
        dayNumber: day.getDate(),
        inMonth: day.getMonth() === month - 1
      }))
    });
  }

  return weeks;
}

export function findWeekByStartDate(weeks = [], startDate) {
  return weeks.find(week => week.startDate === startDate);
}

export function hasPlannedSlots(week = {}) {
  return Object.values(week.plan || {}).some(items => Array.isArray(items) && items.length > 0);
}

export function countPlannedSlots(week = {}) {
  return Object.values(week.plan || {}).filter(items => Array.isArray(items) && items.length > 0).length;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date).replace(".", "");
}
