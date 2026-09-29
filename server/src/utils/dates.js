// All day-bucketing is done in UTC for consistency between Mongo aggregations and JS.
const DAY = 86400000;

// 'YYYY-MM-DD' → UTC midnight (or the last ms of that day); other strings → Date; invalid → null.
function parseDateParam(value, endOfDay = false) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    return endOfDay ? new Date(d.getTime() + DAY - 1) : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ymd = (d) => d.toISOString().slice(0, 10);
const startOfDayUTC = (d) => new Date(`${ymd(new Date(d))}T00:00:00.000Z`);

module.exports = { DAY, parseDateParam, ymd, startOfDayUTC };
