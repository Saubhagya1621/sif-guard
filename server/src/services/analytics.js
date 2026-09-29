// Aggregations shared by /dashboard/* and /export. `match` is an already-scoped Mongo filter.
const ml = require('./mlClient');
const cache = require('./cache');
const { Report } = require('../models');
const { SITE_NAME, RULES } = require('../config/constants');
const { toReport } = require('../utils/serialize');
const { DAY, ymd, startOfDayUTC } = require('../utils/dates');
const { E } = require('../utils/errors');

const SIF = { $cond: [{ $eq: ['$classification', 'SIF'] }, 1, 0] };

async function summary(match) {
  const [a] = await Report.aggregate([
    { $match: match },
    {
      $group: {
        _id: null, total: { $sum: 1 }, sif: { $sum: SIF },
        reviewed: { $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] } },
        last: { $max: '$updatedAt' },
      },
    },
  ]);
  const total = a?.total || 0;
  const sif = a?.sif || 0;
  return {
    totalReports: total,
    sifCount: sif,
    sifPercent: total ? Math.round((sif / total) * 1000) / 10 : 0,
    reviewedCount: a?.reviewed || 0,
    lastUpdated: a?.last ? a.last.toISOString() : null,
  };
}

async function siteRanking(match, siteIds) {
  const [base, rules, barriers] = await Promise.all([
    Report.aggregate([{ $match: match }, { $group: { _id: '$siteId', total: { $sum: 1 }, sif: { $sum: SIF } } }]),
    Report.aggregate([
      { $match: { ...match, classification: 'SIF' } },
      { $unwind: '$lifeSavingRules' },
      { $group: { _id: { s: '$siteId', k: '$lifeSavingRules.rule' }, c: { $sum: 1 } } },
      { $sort: { c: -1, '_id.k': 1 } },
    ]),
    Report.aggregate([
      { $match: { ...match, classification: 'SIF', barrierFailureType: { $ne: 'none' } } },
      { $group: { _id: { s: '$siteId', k: '$barrierFailureType' }, c: { $sum: 1 } } },
      { $sort: { c: -1, '_id.k': 1 } },
    ]),
  ]);
  const firstPerSite = (rows) => rows.reduce((m, r) => { m[r._id.s] ??= r._id.k; return m; }, {});
  const topRule = firstPerSite(rules);
  const topBarrier = firstPerSite(barriers);
  const counts = Object.fromEntries(base.map((b) => [b._id, b]));

  const items = siteIds.map((siteId) => {
    const total = counts[siteId]?.total || 0;
    const sif = counts[siteId]?.sif || 0;
    return {
      siteId, siteName: SITE_NAME[siteId], totalReports: total, sifCount: sif,
      sifDensity: total ? Math.round((sif / total) * 1000) / 1000 : 0,
      rank: 0, topRule: topRule[siteId] || null, topBarrier: topBarrier[siteId] || null,
    };
  });
  items.sort((a, b) => b.sifDensity - a.sifDensity || b.sifCount - a.sifCount || b.totalReports - a.totalReports);
  items.forEach((it, i) => { it.rank = i + 1; });
  return items;
}

// Daily totals with zero-filled gaps. Without from/to: up to 90 days ending at the latest report (min 14 days).
async function trends(baseMatch, from, to) {
  const edge = (dir) => Report.findOne(baseMatch).sort({ reportedAt: dir }).select('reportedAt').lean();
  const [latest, earliest] = await Promise.all([to ? null : edge(-1), from ? null : edge(1)]);
  const lastDay = startOfDayUTC(to || latest?.reportedAt || new Date());
  let firstDay;
  if (from) {
    firstDay = startOfDayUTC(from);
  } else {
    const early = earliest ? startOfDayUTC(earliest.reportedAt).getTime() : lastDay.getTime();
    firstDay = new Date(Math.min(Math.max(early, lastDay.getTime() - 89 * DAY), lastDay.getTime() - 13 * DAY));
  }
  if (firstDay > lastDay) throw E.validation('from must be on or before to');
  if (lastDay - firstDay > 366 * DAY) throw E.validation('Date range too large (max 366 days)');

  const rows = await Report.aggregate([
    { $match: { ...baseMatch, reportedAt: { $gte: firstDay, $lt: new Date(lastDay.getTime() + DAY) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$reportedAt' } }, total: { $sum: 1 }, flagged: { $sum: SIF } } },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const daily = [];
  for (let t = firstDay.getTime(); t <= lastDay.getTime(); t += DAY) {
    const date = ymd(new Date(t));
    daily.push({ date, total: byDay.get(date)?.total || 0, flagged: byDay.get(date)?.flagged || 0 });
  }
  return daily;
}

async function ruleDistribution(match) {
  const rows = await Report.aggregate([
    { $match: match },
    { $unwind: '$lifeSavingRules' },
    { $group: { _id: '$lifeSavingRules.rule', count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return RULES.map((rule) => ({ rule, count: counts[rule] || 0 })).sort((a, b) => b.count - a.count);
}

// Recurring precursor patterns via ML /cluster, cached ~10 min; serves stale data if ML is down.
async function patterns(match) {
  const key = JSON.stringify(match);
  const hit = cache.get(key);
  if (hit?.fresh) return hit.value;
  try {
    const reports = await Report.find(match).sort({ reportedAt: -1 }).limit(2000)
      .select('id text activity location barrierFailureType lifeSavingRules siteId').lean();
    if (reports.length < 5) { cache.set(key, []); return []; }
    const res = await ml.cluster(reports.map((r) => ({
      id: r.id, text: r.text, activity: r.activity, location: r.location,
      barrierFailureType: r.barrierFailureType, rules: (r.lifeSavingRules || []).map((x) => x.rule), siteId: r.siteId,
    })));
    const items = (res?.clusters || []).map((c, i) => ({
      id: c.id || `C${i + 1}`,
      label: c.label || 'Recurring pattern',
      activity: c.activity || '',
      location: c.location || '',
      barrierFailureType: c.barrierFailureType || 'none',
      rule: c.rule || null,
      count: c.count ?? (c.reportIds || []).length,
      siteIds: c.siteIds || [],
      exampleReportIds: (c.reportIds || []).slice(0, 5),
    })).sort((a, b) => b.count - a.count);
    cache.set(key, items);
    return items;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

async function topSifReports(match, n = 10) {
  const rows = await Report.find({ ...match, classification: 'SIF' }).sort({ sifProbability: -1, reportedAt: -1 }).limit(n).lean();
  return rows.map(toReport);
}

module.exports = { summary, siteRanking, trends, ruleDistribution, patterns, topSifReports };
