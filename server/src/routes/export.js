const router = require('express').Router();
const { Report } = require('../models');
const { SITE_IDS } = require('../config/constants');
const { authenticate, requireRole } = require('../middleware/auth');
const { scopeFilter } = require('../services/scope');
const A = require('../services/analytics');
const { buildPdf, buildXlsx } = require('../services/exporter');
const { E, ah } = require('../utils/errors');
const { z, parse, clean, dateStr } = require('../utils/validation');
const { DAY, parseDateParam, ymd, startOfDayUTC } = require('../utils/dates');

const query = z.object({
  format: z.enum(['pdf', 'xlsx']).default('pdf'),
  from: dateStr.optional(),
  to: dateStr.optional(),
  siteId: z.enum(SITE_IDS).optional(),
});

// GET /api/export?format=pdf|xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD
// Default period: the 7 days ending at the latest report.
router.get('/', authenticate, requireRole('admin', 'hse_officer'), ah(async (req, res) => {
  const q = parse(query, clean(req.query));
  let to = q.to ? parseDateParam(q.to, true) : null;
  if (!to) {
    const latest = await Report.findOne().sort({ reportedAt: -1 }).select('reportedAt').lean();
    to = new Date(startOfDayUTC(latest?.reportedAt || new Date()).getTime() + DAY - 1);
  }
  const from = q.from ? parseDateParam(q.from) : new Date(startOfDayUTC(to).getTime() - 6 * DAY);
  if (from > to) throw E.validation('from must be on or before to');

  const site = scopeFilter(req.user, q.siteId);
  const match = { ...site, reportedAt: { $gte: from, $lte: to } };
  const [summary, sites, topReports] = await Promise.all([
    A.summary(match),
    A.siteRanking(match, site.siteId ? [site.siteId] : SITE_IDS),
    A.topSifReports(match, 10),
  ]);
  const data = { from: ymd(from), to: ymd(to), generatedAt: new Date(), generatedBy: req.user.name, summary, sites, topReports, patterns: [] };
  try {
    data.patterns = (await A.patterns(match)).slice(0, 5);
  } catch {
    data.patternsNote = 'Pattern mining unavailable (ML service offline).';
  }

  res.setHeader('Content-Disposition', `attachment; filename="sif-guard-priority-list_${data.from}_${data.to}.${q.format}"`);
  if (q.format === 'pdf') {
    res.type('application/pdf');
    buildPdf(data, res);
  } else {
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await buildXlsx(data, res);
    res.end();
  }
}));

module.exports = router;
