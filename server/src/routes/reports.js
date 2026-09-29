const router = require('express').Router();
const multer = require('multer');
const { Report, AuditLog, Correction } = require('../models');
const C = require('../config/constants');
const { authenticate, requireRole } = require('../middleware/auth');
const { scopeFilter } = require('../services/scope');
const { readRows } = require('../services/parser');
const { runUpload } = require('../services/pipeline');
const cache = require('../services/cache');
const { E, ah } = require('../utils/errors');
const { z, parse, clean, dateStr, escapeRegex } = require('../utils/validation');
const { parseDateParam } = require('../utils/dates');
const { toReport } = require('../utils/serialize');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (/\.(csv|xlsx)$/i.test(file.originalname)
    ? cb(null, true)
    : cb(E.validation('Only .csv and .xlsx files are supported'))),
});

router.use(authenticate);

// POST /api/reports/upload
router.post('/upload', requireRole('admin', 'hse_officer'), upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw E.validation('Attach a .csv or .xlsx file in the "file" field');
  const rows = await readRows(req.file);
  const result = await runUpload({ rows, fileName: req.file.originalname, user: req.user });
  res.json(result);
}));

// GET /api/reports
const listQuery = z.object({
  siteId: z.enum(C.SITE_IDS).optional(),
  classification: z.enum(C.CLASSIFICATIONS).optional(),
  rule: z.enum(C.RULES).optional(),
  barrier: z.enum(C.BARRIERS).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  q: z.string().max(200).optional(),
  status: z.enum(C.STATUSES).optional(),
  batchId: z.string().max(40).optional(), // extension: lets Upload link to "reports from this batch"
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', ah(async (req, res) => {
  const q = parse(listQuery, clean(req.query));
  const filter = { ...scopeFilter(req.user, q.siteId) };
  if (q.classification) filter.classification = q.classification;
  if (q.rule) filter['lifeSavingRules.rule'] = q.rule;
  if (q.barrier) filter.barrierFailureType = q.barrier;
  if (q.status) filter.status = q.status;
  if (q.batchId) filter.batchId = q.batchId;
  if (q.from || q.to) {
    filter.reportedAt = {};
    if (q.from) filter.reportedAt.$gte = parseDateParam(q.from);
    if (q.to) filter.reportedAt.$lte = parseDateParam(q.to, true);
  }
  if (q.q?.trim()) {
    const rx = new RegExp(escapeRegex(q.q.trim()), 'i');
    filter.$or = [{ text: rx }, { id: rx }, { activity: rx }, { location: rx }, { reportedBy: rx }];
  }
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ reportedAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Report.countDocuments(filter),
  ]);
  res.json({ items: items.map(toReport), total, page: q.page, limit: q.limit });
}));

// GET /api/reports/:id  → { report, audit }
router.get('/:id', ah(async (req, res) => {
  const report = await Report.findOne({ id: req.params.id, ...scopeFilter(req.user) }).lean();
  if (!report) throw E.notFound(`Report ${req.params.id} not found`);
  const audit = await AuditLog.find({
    $or: [{ reportId: report.id }, ...(report.batchId ? [{ batchId: report.batchId, action: 'upload' }] : [])],
  }).sort({ at: 1 }).lean();
  res.json({
    report: toReport(report),
    audit: audit.map((a) => ({ at: a.at.toISOString(), byName: a.byName, action: a.action, detail: a.detail })),
  });
}));

// PATCH /api/reports/:id/review  (human-in-the-loop override)
const reviewSchema = z.object({
  newClassification: z.enum(C.CLASSIFICATIONS),
  newRules: z.array(z.enum(C.RULES)).max(9).optional(),
  newBarrierFailureType: z.enum(C.BARRIERS).optional(),
  note: z.string().trim().max(1000).optional(),
});

router.patch('/:id/review', requireRole('admin', 'hse_officer'), ah(async (req, res) => {
  const body = parse(reviewSchema, req.body);
  const report = await Report.findOne({ id: req.params.id });
  if (!report) throw E.notFound(`Report ${req.params.id} not found`);

  const before = {
    classification: report.classification,
    rules: report.lifeSavingRules.map((r) => r.rule),
    barrier: report.barrierFailureType,
  };
  const originalClassification = report.review?.originalClassification || report.classification;

  report.classification = body.newClassification;
  if (body.newRules) report.lifeSavingRules = [...new Set(body.newRules)].map((rule) => ({ rule, confidence: 1 }));
  if (body.newBarrierFailureType) report.barrierFailureType = body.newBarrierFailureType;
  report.status = 'reviewed';
  report.review = {
    by: req.user._id.toString(),
    byName: req.user.name,
    at: new Date().toISOString(),
    originalClassification,
    newClassification: body.newClassification,
    newRules: report.lifeSavingRules.map((r) => r.rule),
    newBarrierFailureType: report.barrierFailureType,
    note: body.note || '',
  };
  await report.save();

  const changes = [`classification ${before.classification} -> ${report.classification}`];
  if (body.newRules) changes.push(`rules [${before.rules.join(', ')}] -> [${report.review.newRules.join(', ')}]`);
  if (body.newBarrierFailureType) changes.push(`barrier ${before.barrier} -> ${report.barrierFailureType}`);
  if (body.note) changes.push(`note: ${body.note}`);

  await Promise.all([
    AuditLog.create({ reportId: report.id, action: 'review', by: req.user._id, byName: req.user.name, detail: changes.join('; ') }),
    // Stored for the next retrain (latest review of a report replaces the previous one).
    Correction.findOneAndUpdate(
      { reportId: report.id },
      {
        text: report.text, classification: report.classification, rules: report.review.newRules,
        barrierFailureType: report.barrierFailureType, used: false, by: req.user._id,
      },
      { upsert: true },
    ),
  ]);
  cache.clear();
  res.json({ report: toReport(report) });
}));

module.exports = router;
