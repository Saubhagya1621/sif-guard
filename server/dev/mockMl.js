// Keyword-based stand-in for the real ML service (contract §3 shapes). Lets the backend run before
// Dev A's FastAPI service is merged.  Run: npm run mock-ml  (port 8000, or MOCK_ML_PORT)
const express = require('express');
const { RULE_LABELS, BARRIER_LABELS } = require('../src/config/constants');

const RULE_KEYWORDS = {
  energy_isolation: ['lockout', 'loto', 'isolat', 'still connected', 'energised', 'energized', 'live line', 'tagout', 'without bleeding', 'residual pressure'],
  hot_work: ['welding', 'grinding', 'hot work', 'gas cutting', 'cutting torch', 'spark'],
  confined_space: ['confined', 'vessel', 'tank entry', 'manhole', 'pit', 'atmospheric testing', 'gas test'],
  working_at_height: ['height', 'harness', 'scaffold', 'ladder', 'monkey board', 'derrick', 'fall from', 'handrail'],
  safe_mechanical_lifting: ['crane', 'suspended load', 'sling', 'rigging', 'rigger', 'hoist', 'shackle', 'tagline'],
  line_of_fire: ['line of fire', 'struck by', 'pinch', 'pressurised', 'pressurized', 'whipped', 'dropped object', 'caught between'],
  driving: ['driving', 'driver', 'vehicle', 'truck', 'tanker', 'overspeed', 'seat belt', 'seatbelt', 'reversing'],
  work_authorisation: ['permit', 'ptw', 'unauthori', 'without authoris', 'without authoriz'],
  bypassing_safety_controls: ['bypass', 'interlock', 'override', 'disabled the', 'alarm silenced', 'inhibit', 'jumper'],
};
const STRONG = [
  'without lockout', 'no lockout', 'still connected', 'live line', 'under suspended load', 'no harness', 'without harness',
  'without permit', 'without hot work permit', 'no permit', 'no gas test', 'gas test not', 'before atmospheric testing',
  'standby man was not present', 'no standby', 'bypass', 'interlock', 'line of fire', 'without bleeding', 'fall from',
  'overspeeding', 'nearly hit', 'crushed', 'caught between', 'h2s', 'blowout', 'dropped object', 'whipped',
];
const MINOR = ['no injury', 'housekeeping', 'wet floor', 'slipped', 'first aid', 'minor', 'oily rags', 'untidy', 'signage'];
const BARRIER_KEYWORDS = [
  ['isolation', ['lockout', 'isolat', 'still connected', 'without bleeding', 'energised', 'energized']],
  ['ppe', ['harness', 'helmet', 'glove', 'goggle', 'ppe', 'respirator', 'safety shoe']],
  ['procedure', ['permit', 'procedure', 'sop', 'jsa', 'bypass', 'interlock', 'overspeed', 'gas test']],
  ['supervision', ['unsupervised', 'no supervisor', 'standby', 'tagline', 'alone', 'under suspended load']],
  ['equipment', ['faulty', 'leak', 'damaged', 'corroded', 'broken', 'defective', 'loose']],
  ['training', ['untrained', 'not trained', 'new joinee', 'trainee', 'inexperienced']],
];
const ACTIVITIES = [
  [/pump/i, 'Pump maintenance'], [/weld|grind|hot work|gas cutting/i, 'Hot work'], [/crane|lift|sling|rigg/i, 'Crane lift'],
  [/vessel|confined|separator|manhole|tank entry/i, 'Confined space entry'], [/monkey board|derrick|scaffold|height|ladder/i, 'Work at height'],
  [/driv|vehicle|tanker|truck|road/i, 'Vehicle movement'], [/drill|tripping|rig floor/i, 'Drilling'], [/compressor/i, 'Compressor operation'],
  [/hose|well test|flowline|pipeline/i, 'Well testing'], [/electri|mcc|panel|cable/i, 'Electrical work'], [/chemical|drum/i, 'Chemical handling'],
];
const LOCATION_RX = /\b(well ?pad[- ]?\d+|rig [a-z]{2,4}-?\d+|ggs[- ]?\d+|ocs[- ]?\d+|tank farm|workshop|pump house|compressor station|control room|field road|mud tank area)\b/i;
const EQUIPMENT_RX = /\b(pump|crane|compressor|separator|tank|hose|vehicle|tanker|scaffold|ladder|valve|motor|generator|drill pipe|monkey board)\b/i;

const round = (n) => Math.round(n * 100) / 100;
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const findAll = (lower, words) => words.map((w) => {
  const i = lower.indexOf(w);
  return i === -1 ? null : { start: i, end: i + w.length };
}).filter(Boolean);
// Keep the longest non-overlapping spans.
const nonOverlapping = (spans) => {
  const out = [];
  [...spans].sort((a, b) => (b.end - b.start) - (a.end - a.start)).forEach((s) => {
    if (!out.some((q) => s.start < q.end && q.start < s.end)) out.push(s);
  });
  return out;
};

function tagRules(text) {
  const lower = text.toLowerCase();
  return Object.entries(RULE_KEYWORDS)
    .map(([rule, words]) => {
      const hits = nonOverlapping(findAll(lower, words)).length;
      return { rule, confidence: hits ? round(Math.min(0.95, 0.45 + 0.15 * hits)) : 0 };
    })
    .filter((r) => r.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function classifyOne({ id, text }) {
  const lower = text.toLowerCase();
  const strong = nonOverlapping(findAll(lower, STRONG));
  const minor = nonOverlapping(findAll(lower, MINOR));
  const rules = tagRules(text);
  // One serious precursor (e.g. "under suspended load") is enough to cross 0.5, even with no injury.
  const p = Math.min(0.97, Math.max(0.03, 0.2 + 0.35 * strong.length + 0.05 * rules.length - 0.05 * minor.length));
  const phrases = nonOverlapping([
    ...strong.map((s) => ({ ...s, weight: 0.42 })),
    ...minor.map((s) => ({ ...s, weight: 0.15 })),
  ]).slice(0, 5).sort((a, b) => a.start - b.start);
  const barrier = (BARRIER_KEYWORDS.find(([, words]) => findAll(lower, words).length) || ['none'])[0];
  const activity = (ACTIVITIES.find(([rx]) => rx.test(text)) || [null, 'General operations'])[1];
  return {
    id,
    classification: p >= 0.5 ? 'SIF' : 'NON_SIF',
    sifProbability: round(p),
    confidence: round(0.6 + Math.abs(p - 0.5) * 0.7),
    highlightedPhrases: phrases.map((s) => ({ text: text.slice(s.start, s.end), start: s.start, end: s.end, weight: s.weight })),
    potentialSeverity: p >= 0.75 ? 'fatal' : p >= 0.5 ? 'serious' : 'minor',
    barrierFailureType: barrier,
    entities: {
      activity,
      location: titleCase(text.match(LOCATION_RX)?.[0] || ''),
      equipment: (text.match(EQUIPMENT_RX)?.[0] || '').toLowerCase(),
    },
  };
}

// Group by activity + barrier + primary rule; groups of 2+ become patterns.
function clusterReports(reports) {
  if (reports.length < 5) return [];
  const groups = new Map();
  for (const r of reports) {
    const rule = (r.rules || [])[0];
    if (!rule) continue;
    const key = [r.activity || 'General operations', r.barrierFailureType || 'none', rule].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const mostCommon = (arr) => Object.entries(arr.reduce((m, v) => { if (v) m[v] = (m[v] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return [...groups.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, members], i) => {
      const [activity, barrier, rule] = key.split('|');
      return {
        id: `C${i + 1}`,
        label: barrier !== 'none'
          ? `${BARRIER_LABELS[barrier]} failure during ${activity.toLowerCase()}`
          : `${RULE_LABELS[rule]} precursors in ${activity.toLowerCase()}`,
        activity,
        location: mostCommon(members.map((m) => m.location)),
        barrierFailureType: barrier,
        rule,
        count: members.length,
        siteIds: [...new Set(members.map((m) => m.siteId))],
        reportIds: members.map((m) => m.id),
      };
    });
}

let state = {
  modelVersion: 'mock-v1', accuracy: 0.87, precision: 0.84, recall: 0.9, f1: 0.87,
  lastTrainedAt: new Date().toISOString(), trainingSamples: 1500,
};
const getMetrics = () => ({ ...state });
function retrain(corrections = []) {
  const n = Number(state.modelVersion.split('v')[1]) + 1;
  state = {
    ...state, modelVersion: `mock-v${n}`, lastTrainedAt: new Date().toISOString(),
    trainingSamples: state.trainingSamples + corrections.length,
    accuracy: round(Math.min(0.95, state.accuracy + 0.005)), f1: round(Math.min(0.94, state.f1 + 0.005)),
  };
  return { status: 'completed', trainedOn: corrections.length, modelVersion: state.modelVersion, metrics: { accuracy: state.accuracy, f1: state.f1 } };
}

module.exports = { classifyOne, tagRules, clusterReports, getMetrics, retrain };

if (require.main === module) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  const list = (req) => (Array.isArray(req.body?.reports) ? req.body.reports : []);
  app.get('/health', (req, res) => res.json({ status: 'ok', modelVersion: state.modelVersion }));
  app.post('/classify', (req, res) => res.json({ results: list(req).map(classifyOne) }));
  app.post('/tag-rules', (req, res) => res.json({ results: list(req).map((r) => ({ id: r.id, lifeSavingRules: tagRules(r.text || '') })) }));
  app.post('/cluster', (req, res) => res.json({ clusters: clusterReports(list(req)) }));
  app.post('/retrain', (req, res) => res.json(retrain(req.body?.corrections)));
  app.get('/metrics', (req, res) => res.json(getMetrics()));
  const port = Number(process.env.MOCK_ML_PORT) || 8000;
  app.listen(port, '0.0.0.0', () => console.log(`[mock-ml] listening on http://localhost:${port}`));
}
