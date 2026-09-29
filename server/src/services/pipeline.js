// Upload pipeline: validate → dedupe → assign ids → ML /classify + /tag-rules in batches of 32 → store → audit → notify.
const ml = require('./mlClient');
const cache = require('./cache');
const env = require('../config/env');
const { Report, AuditLog, Notification, nextReportIds, bumpReportCounter } = require('../models');
const { normalizeRow } = require('./parser');
const C = require('../config/constants');

const BATCH_SIZE = 32;
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const clamp01 = (n, d = 0) => Math.min(1, Math.max(0, num(n, d)));
const r3 = (n) => Math.round(n * 1000) / 1000;

// Merge ML outputs into report fields, defensively enforcing the contract's enums and limits.
function mergeMl(row, cls = {}, tag = {}) {
  const sifProbability = r3(clamp01(cls.sifProbability));
  const classification = C.CLASSIFICATIONS.includes(cls.classification) ? cls.classification : (sifProbability >= 0.5 ? 'SIF' : 'NON_SIF');
  const highlightedPhrases = (cls.highlightedPhrases || [])
    .filter((p) => Number.isInteger(p?.start) && Number.isInteger(p?.end) && p.start >= 0 && p.end <= row.text.length && p.end > p.start)
    .map((p) => ({ text: row.text.slice(p.start, p.end), start: p.start, end: p.end, weight: num(p.weight) }));
  const lifeSavingRules = (tag.lifeSavingRules || [])
    .filter((r) => C.RULES.includes(r?.rule) && num(r.confidence) >= 0.4)
    .map((r) => ({ rule: r.rule, confidence: r3(clamp01(r.confidence)) }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  const fallbackSeverity = sifProbability >= 0.75 ? 'fatal' : sifProbability >= 0.5 ? 'serious' : 'minor';
  return {
    classification,
    sifProbability,
    confidence: r3(clamp01(cls.confidence)),
    highlightedPhrases,
    lifeSavingRules,
    potentialSeverity: C.SEVERITIES.includes(cls.potentialSeverity) ? cls.potentialSeverity : fallbackSeverity,
    barrierFailureType: C.BARRIERS.includes(cls.barrierFailureType) ? cls.barrierFailureType : 'none',
    entities: cls.entities || null,
    activity: row.activity || cls.entities?.activity || '',
    location: row.location || cls.entities?.location || '',
  };
}

const notificationMessage = (r) => {
  const rule = r.lifeSavingRules?.[0] ? ` · ${C.RULE_LABELS[r.lifeSavingRules[0].rule]}` : '';
  return `${C.REPORT_TYPE_LABELS[r.reportType] || 'Report'} ${r.id} at ${r.siteName}: ${Math.round(r.sifProbability * 100)}% SIF probability${rule}`;
};

async function createNotifications(reports) {
  const hot = reports.filter((r) => r.sifProbability >= env.NOTIFY_THRESHOLD);
  if (!hot.length) return 0;
  await Notification.insertMany(hot.map((r) => ({
    reportId: r.id, siteId: r.siteId, sifProbability: r.sifProbability, message: notificationMessage(r),
  })));
  return hot.length;
}

async function runUpload({ rows, fileName, user }) {
  const batchId = `B-${Date.now().toString(36).toUpperCase()}`;
  const errors = [];

  // 1. Row validation + in-file duplicates
  const candidates = [];
  const seenKeys = new Set();
  const seenIds = new Set();
  for (const raw of rows) {
    const r = normalizeRow(raw);
    if (r.error) { errors.push({ row: r.row, message: r.error }); continue; }
    if (seenKeys.has(r.value.dedupeKey)) { errors.push({ row: r.row, message: 'Duplicate of an earlier row in this file' }); continue; }
    if (r.value.id && seenIds.has(r.value.id)) { errors.push({ row: r.row, message: `report_id ${r.value.id} appears twice in this file` }); continue; }
    seenKeys.add(r.value.dedupeKey);
    if (r.value.id) seenIds.add(r.value.id);
    candidates.push(r);
  }

  // 2. Drop rows already stored (same site + text + reportedAt) or reusing an existing id
  const existing = candidates.length ? await Report.find({
    $or: [
      { dedupeKey: { $in: candidates.map((c) => c.value.dedupeKey) } },
      { id: { $in: candidates.map((c) => c.value.id).filter(Boolean) } },
    ],
  }).select('id dedupeKey').lean() : [];
  const storedByKey = new Map(existing.map((e) => [e.dedupeKey, e.id]));
  const storedIds = new Set(existing.map((e) => e.id));
  const fresh = [];
  for (const c of candidates) {
    if (storedByKey.has(c.value.dedupeKey)) errors.push({ row: c.row, message: `Duplicate: already stored as ${storedByKey.get(c.value.dedupeKey)}` });
    else if (c.value.id && storedIds.has(c.value.id)) errors.push({ row: c.row, message: `report_id ${c.value.id} already exists` });
    else fresh.push(c);
  }

  // 3. Assign ids
  await bumpReportCounter(Math.max(0, ...fresh.filter((c) => c.value.id).map((c) => Number(c.value.id.slice(2)))));
  const newIds = await nextReportIds(fresh.filter((c) => !c.value.id).length);
  fresh.forEach((c) => { if (!c.value.id) c.value.id = newIds.shift(); });

  // 4. ML in batches of 32; if ML goes down, remaining rows are skipped instead of failing the upload
  const docs = [];
  let mlError = null;
  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const chunk = fresh.slice(i, i + BATCH_SIZE);
    if (mlError) { chunk.forEach((c) => errors.push({ row: c.row, message: `Skipped: ${mlError}` })); continue; }
    try {
      const [cls, tags] = await Promise.all([
        ml.classify(chunk.map((c) => ({ id: c.value.id, text: c.value.text, language: c.value.language }))),
        ml.tagRules(chunk.map((c) => ({ id: c.value.id, text: c.value.text }))),
      ]);
      const clsById = new Map((cls?.results || []).map((r) => [r.id, r]));
      const tagById = new Map((tags?.results || []).map((r) => [r.id, r]));
      for (const c of chunk) {
        const res = clsById.get(c.value.id);
        if (!res) { errors.push({ row: c.row, message: 'Skipped: ML service returned no result for this row' }); continue; }
        docs.push({
          row: c.row,
          doc: {
            ...c.value,
            ...mergeMl(c.value, res, tagById.get(c.value.id)),
            siteName: C.SITE_NAME[c.value.siteId],
            status: 'auto',
            review: null,
            batchId,
            uploadedBy: user._id,
          },
        });
      }
    } catch (err) {
      if (err.code !== 'ML_UNAVAILABLE') throw err;
      mlError = 'ML service unavailable (ML_UNAVAILABLE)';
      chunk.forEach((c) => errors.push({ row: c.row, message: `Skipped: ${mlError}` }));
    }
  }

  // 5. Store
  let inserted = [];
  if (docs.length) {
    try {
      inserted = await Report.insertMany(docs.map((d) => d.doc), { ordered: false });
    } catch (err) {
      console.error('[upload] insertMany failed:', err.message);
      // Rare race (same file uploaded twice at once): keep whatever made it in.
      inserted = await Report.find({ batchId }).lean();
      const ok = new Set(inserted.map((r) => r.id));
      docs.filter((d) => !ok.has(d.doc.id)).forEach((d) => errors.push({ row: d.row, message: 'Could not be saved (duplicate or invalid data)' }));
    }
  }
  inserted = inserted.map((r) => (r.toObject ? r.toObject() : r));

  // 6. Audit trail + notifications + cache invalidation
  const sifCount = inserted.filter((r) => r.classification === 'SIF').length;
  await AuditLog.insertMany([
    {
      batchId, action: 'upload', by: user._id, byName: user.name,
      detail: `Uploaded ${fileName}: ${inserted.length}/${rows.length} rows stored, ${sifCount} flagged SIF`,
    },
    ...inserted.map((r) => ({
      reportId: r.id, batchId, action: 'auto_classified', byName: 'SIF-Guard model',
      detail: `Classified ${r.classification} (p=${r.sifProbability.toFixed(2)}, potential severity ${r.potentialSeverity}, barrier ${r.barrierFailureType})`
        + (r.lifeSavingRules.length ? `; rules: ${r.lifeSavingRules.map((x) => x.rule).join(', ')}` : ''),
    })),
  ]);
  await createNotifications(inserted);
  if (inserted.length) cache.clear();

  errors.sort((a, b) => a.row - b.row);
  return { batchId, total: rows.length, inserted: inserted.length, sifCount, skipped: rows.length - inserted.length, errors };
}

module.exports = { runUpload, mergeMl, createNotifications };
