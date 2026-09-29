const router = require('express').Router();
const { SITE_IDS } = require('../config/constants');
const { authenticate } = require('../middleware/auth');
const { scopeFilter } = require('../services/scope');
const A = require('../services/analytics');
const { ah } = require('../utils/errors');
const { z, parse, clean, dateStr } = require('../utils/validation');
const { parseDateParam } = require('../utils/dates');

router.use(authenticate);

// All dashboard endpoints accept optional siteId/from/to; supervisors are always pinned to their site.
const query = z.object({ siteId: z.enum(SITE_IDS).optional(), from: dateStr.optional(), to: dateStr.optional() });

function scoped(req, withDates = true) {
  const q = parse(query, clean(req.query));
  const site = scopeFilter(req.user, q.siteId);
  const match = { ...site };
  const from = q.from ? parseDateParam(q.from) : undefined;
  const to = q.to ? parseDateParam(q.to, true) : undefined;
  if (withDates && (from || to)) {
    match.reportedAt = {};
    if (from) match.reportedAt.$gte = from;
    if (to) match.reportedAt.$lte = to;
  }
  return { match, site, from, to };
}

router.get('/summary', ah(async (req, res) => res.json(await A.summary(scoped(req).match))));

router.get('/sites', ah(async (req, res) => {
  const { match, site } = scoped(req);
  res.json({ items: await A.siteRanking(match, site.siteId ? [site.siteId] : SITE_IDS) });
}));

router.get('/patterns', ah(async (req, res) => res.json({ items: await A.patterns(scoped(req).match) })));

router.get('/trends', ah(async (req, res) => {
  const { site, from, to } = scoped(req, false);
  res.json({ daily: await A.trends(site, from, to) });
}));

router.get('/rules', ah(async (req, res) => res.json({ items: await A.ruleDistribution(scoped(req).match) })));

module.exports = router;
