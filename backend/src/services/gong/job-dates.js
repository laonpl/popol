// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
function normalizeJobDate(value) {
  if (typeof value !== "string") return void 0;
  const match = value.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(.*)$/);
  if (!match) return void 0;
  const [, y, m, d, tail] = match;
  const date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const day = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return void 0;
  if (!tail || /^\s*\([월화수목금토일]\)$/.test(tail)) return date;
  if (!/^[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(tail)) return void 0;
  const time = date + tail.replace(/^ /, "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(time) ? time : `${time}+09:00`;
  return Number.isFinite(Date.parse(zoned)) ? zoned : void 0;
}
function dateTime(value, endOfDay = false) {
  const date = normalizeJobDate(value);
  if (!date) return NaN;
  return Date.parse(date.length === 10 ? `${date}T${endOfDay ? "23:59:59.999" : "00:00:00"}+09:00` : date);
}
function displayDate(value) {
  const time = dateTime(value);
  if (!Number.isFinite(time)) return "\uBBF8\uD655\uC778";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", ...value.length > 10 ? { hour: "2-digit", minute: "2-digit", hour12: false } : {} }).format(time);
}
export {
  dateTime,
  displayDate,
  normalizeJobDate
};
