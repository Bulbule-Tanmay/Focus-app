// Small date helpers shared between the chat view and the board view.
// All "ISO" dates here are plain YYYY-MM-DD strings (no time/timezone math).

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(d) {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((dt - now) / 86400000);
}

export function addDaysISO(iso, delta) {
  const dt = new Date(iso + "T00:00:00");
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// "Monday, Aug 17th"
export function formatLongDate(iso) {
  const dt = new Date(iso + "T00:00:00");
  const weekday = dt.toLocaleDateString(undefined, { weekday: "long" });
  const month = dt.toLocaleDateString(undefined, { month: "short" });
  return `${weekday}, ${month} ${ordinal(dt.getDate())}`;
}
