// Idempotent seed: sites (upsert), demo users (only if missing), reports (only if the collection is empty).
//   node seed.js          → seed what's missing
//   node seed.js --reset  → wipe reports/audit/notifications/corrections and reseed them
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/db');
const M = require('./src/models');
const C = require('./src/config/constants');
const { dedupeKey } = require('./src/services/parser');
const { createNotifications } = require('./src/services/pipeline');

const SEED_FILE = process.env.SEED_FILE || path.resolve(__dirname, '../docs/seed_reports.json');

const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@sifguard.dev', password: 'Admin@123', role: 'admin', siteId: null },
  { name: 'A. Bora', email: 'hse@sifguard.dev', password: 'Hse@1234', role: 'hse_officer', siteId: null },
  { name: 'P. Dutta', email: 'manager@sifguard.dev', password: 'Manager@123', role: 'site_supervisor', siteId: 'duliajan' },
];

// [site, type, daysAgo, activity, location, reportedBy, text, SIF p, rules [[key, conf]], barrier, severity, phrases]
const SAMPLES = [
  ['moran', 'near_miss', 2, 'Pump maintenance', 'Well pad 3', 'K. Baruah', 'Fitter opened pump casing without lockout while motor was still connected to the MCC. Supervisor stopped the job before start-up.', 0.91, [['energy_isolation', 0.93]], 'isolation', 'fatal', ['without lockout', 'motor was still connected']],
  ['duliajan', 'UA', 5, 'Crane lift', 'Rig DJN-12', 'R. Gogoi', 'Rigger standing under suspended load during crane lift of drill pipe bundle. No tagline used.', 0.88, [['safe_mechanical_lifting', 0.9], ['line_of_fire', 0.62]], 'supervision', 'fatal', ['under suspended load', 'No tagline used']],
  ['naharkatiya', 'UA', 7, 'Hot work', 'GGS-4 tank farm', 'M. Saikia', 'Welding carried out near crude oil tank without hot work permit and no gas test done.', 0.86, [['hot_work', 0.92], ['work_authorisation', 0.7]], 'procedure', 'fatal', ['without hot work permit', 'no gas test done']],
  ['baghjan', 'near_miss', 9, 'Vessel cleaning', 'Production installation', 'J. Das', 'Helper entered the separator vessel for cleaning before atmospheric testing; standby man was not present at the manhole.', 0.93, [['confined_space', 0.95]], 'supervision', 'fatal', ['before atmospheric testing', 'standby man was not present']],
  ['jaisalmer', 'UC', 12, 'Housekeeping', 'Workshop', 'S. Rathore', 'Housekeeping poor near workshop entrance, oily rags lying on the floor.', 0.12, [], 'none', 'minor', ['oily rags']],
  ['duliajan', 'incident', 15, 'General movement', 'Control room', 'B. Phukan', 'Worker slipped on wet floor in the control room, no injury reported.', 0.08, [], 'none', 'minor', ['slipped on wet floor']],
  ['moran', 'UA', 18, 'Tripping operation', 'Rig MRN-5', 'D. Hazarika', 'Derrickman working on monkey board without harness anchored during tripping operation.', 0.9, [['working_at_height', 0.94]], 'ppe', 'fatal', ['without harness anchored']],
  ['jaisalmer', 'near_miss', 22, 'Vehicle movement', 'Field road', 'V. Singh', 'Tanker driver overspeeding on field road at night, nearly hit a parked pickup near well pad 7.', 0.78, [['driving', 0.91]], 'procedure', 'serious', ['overspeeding', 'nearly hit']],
  ['baghjan', 'UA', 26, 'Compressor operation', 'Compressor station', 'N. Borah', 'Operator bypassed the high-pressure trip interlock on the compressor to avoid nuisance shutdowns.', 0.89, [['bypassing_safety_controls', 0.94]], 'procedure', 'fatal', ['bypassed the high-pressure trip interlock']],
  ['naharkatiya', 'UC', 30, 'Inspection', 'Pump house', 'M. Saikia', 'Handrail on the pump house stairs is loose and slightly corroded.', 0.31, [['working_at_height', 0.45]], 'equipment', 'minor', ['loose', 'corroded']],
  ['moran', 'incident', 35, 'Chemical handling', 'Mud tank area', 'K. Baruah', 'Gloves not worn while handling chemical drums, minor skin irritation, first aid given.', 0.22, [], 'ppe', 'minor', ['Gloves not worn']],
  ['duliajan', 'near_miss', 40, 'Well testing', 'Well pad 11', 'R. Gogoi', 'Pressurised hose whipped when the connection was opened without bleeding the line; crew was standing in line of fire.', 0.87, [['line_of_fire', 0.9], ['energy_isolation', 0.66]], 'isolation', 'fatal', ['without bleeding the line', 'standing in line of fire']],
];

const spanOf = (text, phrase) => {
  const i = text.toLowerCase().indexOf(String(phrase).toLowerCase());
  return i === -1 ? null : { text: text.slice(i, i + phrase.length), start: i, end: i + phrase.length, weight: 0.4 };
};
const num = (v, d) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : d);
const confidenceFor = (p) => Math.round((0.6 + Math.abs(p - 0.5) * 0.7) * 100) / 100;

function sampleReports() {
  const now = Date.now();
  return SAMPLES.map(([siteId, reportType, daysAgo, activity, location, reportedBy, text, p, rules, barrier, severity, phrases]) => {
    const reportedAt = new Date(now - daysAgo * 86400000);
    reportedAt.setUTCHours(4, 0, 0, 0);
    return {
      siteId, reportType, reportedAt, activity, location, reportedBy, text, language: 'en',
      classification: p >= 0.5 ? 'SIF' : 'NON_SIF', sifProbability: p, confidence: confidenceFor(p),
      highlightedPhrases: phrases.map((ph) => spanOf(text, ph)).filter(Boolean),
      lifeSavingRules: rules.map(([rule, confidence]) => ({ rule, confidence })),
      barrierFailureType: barrier, potentialSeverity: severity, status: 'auto', review: null,
    };
  });
}

// Accepts Dev C's docs/seed_reports.json (contract Report shape); tolerant of small differences.
function fromSeedFile(r) {
  const siteId = C.SITE_IDS.includes(r.siteId) ? r.siteId : null;
  const reportedAt = new Date(r.reportedAt);
  if (!siteId || !r.text || Number.isNaN(reportedAt.getTime())) return null;
  const text = String(r.text);
  const p = num(r.sifProbability, r.classification === 'SIF' ? 0.8 : 0.2);
  const classification = C.CLASSIFICATIONS.includes(r.classification) ? r.classification : (p >= 0.5 ? 'SIF' : 'NON_SIF');
  return {
    id: /^R-\d+$/.test(r.id || '') ? r.id : null,
    siteId, reportedAt, text,
    reportType: C.REPORT_TYPES.includes(r.reportType) ? r.reportType : 'UA',
    language: C.LANGUAGES.includes(r.language) ? r.language : 'en',
    activity: r.activity || '', location: r.location || '', reportedBy: r.reportedBy || '',
    classification, sifProbability: p, confidence: num(r.confidence, confidenceFor(p)),
    highlightedPhrases: (Array.isArray(r.highlightedPhrases) ? r.highlightedPhrases : [])
      .map((h) => (typeof h === 'string' ? spanOf(text, h) : h))
      .filter((h) => h && Number.isInteger(h.start) && Number.isInteger(h.end) && h.end <= text.length && h.end > h.start)
      .map((h) => ({ text: text.slice(h.start, h.end), start: h.start, end: h.end, weight: Number(h.weight) || 0.4 })),
    lifeSavingRules: (Array.isArray(r.lifeSavingRules) ? r.lifeSavingRules : [])
      .filter((x) => C.RULES.includes(x?.rule)).map((x) => ({ rule: x.rule, confidence: num(x.confidence, 0.8) })),
    barrierFailureType: C.BARRIERS.includes(r.barrierFailureType) ? r.barrierFailureType : 'none',
    potentialSeverity: C.SEVERITIES.includes(r.potentialSeverity) ? r.potentialSeverity : (p >= 0.75 ? 'fatal' : p >= 0.5 ? 'serious' : 'minor'),
    status: r.status === 'reviewed' ? 'reviewed' : 'auto',
    review: r.status === 'reviewed' ? r.review || null : null,
  };
}

function loadReports(log) {
  if (fs.existsSync(SEED_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      const list = (Array.isArray(raw) ? raw : raw.items || raw.reports || []).map(fromSeedFile).filter(Boolean);
      if (list.length) { log(`[seed] using ${list.length} reports from ${SEED_FILE}`); return list; }
      log(`[seed] ${SEED_FILE} had no usable reports, using built-in samples`);
    } catch (err) {
      log(`[seed] could not read ${SEED_FILE} (${err.message}), using built-in samples`);
    }
  } else {
    log('[seed] docs/seed_reports.json not found, using built-in samples');
  }
  return sampleReports();
}

async function seed({ reset = false, log = console.log } = {}) {
  await Promise.all(C.SITES.map((s) => M.Site.updateOne({ id: s.id }, { $set: s }, { upsert: true })));

  for (const u of DEMO_USERS) {
    if (!(await M.User.exists({ email: u.email }))) {
      await M.User.create({ ...u, passwordHash: await bcrypt.hash(u.password, 10) });
      log(`[seed] user ${u.email} (${u.role})`);
    }
  }

  if (reset) {
    await Promise.all([M.Report.deleteMany({}), M.AuditLog.deleteMany({}), M.Notification.deleteMany({}), M.Correction.deleteMany({}), M.Counter.deleteMany({})]);
    log('[seed] reset reports, audit log, notifications, corrections');
  }
  if (await M.Report.estimatedDocumentCount()) { log('[seed] reports already present, skipping'); return; }

  const reports = loadReports(log);
  await M.bumpReportCounter(Math.max(0, ...reports.filter((r) => r.id).map((r) => Number(r.id.slice(2)))));
  const ids = await M.nextReportIds(reports.filter((r) => !r.id).length);
  const seen = new Set();
  const docs = reports.map((r) => ({
    ...r,
    id: r.id || ids.shift(),
    siteName: C.SITE_NAME[r.siteId],
    batchId: 'SEED',
    dedupeKey: dedupeKey(r.siteId, r.reportedAt, r.text),
  })).filter((d) => !seen.has(d.dedupeKey) && seen.add(d.dedupeKey));

  const inserted = (await M.Report.insertMany(docs)).map((d) => d.toObject());
  await M.AuditLog.insertMany(inserted.map((r) => ({
    reportId: r.id, batchId: 'SEED', action: 'seeded', byName: 'system',
    detail: `Imported seed report (${r.classification}, p=${r.sifProbability.toFixed(2)})`,
  })));
  const notified = await createNotifications(inserted);
  log(`[seed] inserted ${inserted.length} reports, ${notified} notifications`);
}

if (require.main === module) {
  (async () => {
    await connectDB();
    await seed({ reset: process.argv.includes('--reset') });
    await mongoose.disconnect();
  })().catch((err) => { console.error('[seed] failed:', err); process.exit(1); });
}

module.exports = { seed };
