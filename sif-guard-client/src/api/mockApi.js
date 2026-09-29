// Demo-mode API: same function names, arguments, return shapes, role rules and error codes as realApi.js,
// backed by in-memory fixtures. Used when VITE_USE_MOCK is not "false" (e.g. the Vercel demo).
import { ApiError } from "./client";
import { MOCK_USERS, REPORTS } from "../data/fixtures";
import { RULE_LABELS, RULES, SITES, SITE_NAME, BARRIER_LABELS } from "../lib/constants";

const DAY = 86400000;
const SESSION_KEY = "sifguard_demo_session";
const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const E = {
  unauth: () => new ApiError(401, "UNAUTHENTICATED", "Authentication required"),
  forbidden: () => new ApiError(403, "FORBIDDEN", "You do not have access to this resource"),
  notFound: (m) => new ApiError(404, "NOT_FOUND", m),
  validation: (m) => new ApiError(400, "VALIDATION_ERROR", m),
};

const db = {
  reports: clone(REPORTS),
  users: clone(MOCK_USERS),
  audit: {},
  notifications: [],
  pendingCorrections: 0,
  nextId: 2000,
  nextNotif: 1,
  nextUser: 100,
  model: {
    modelVersion: "demo-v1", accuracy: 0.93, precision: 0.85, recall: 0.94, f1: 0.89,
    lastTrainedAt: new Date(Date.now() - 3 * DAY).toISOString(), trainingSamples: 1600,
  },
};

function addAudit(reportId, byName, action, detail) {
  (db.audit[reportId] ||= []).push({ at: new Date().toISOString(), byName, action, detail });
}
function notify(r) {
  const rule = r.lifeSavingRules[0] ? ` · ${RULE_LABELS[r.lifeSavingRules[0].rule]}` : "";
  db.notifications.unshift({
    id: `n${db.nextNotif++}`, reportId: r.id, siteId: r.siteId, sifProbability: r.sifProbability,
    message: `${r.id} at ${r.siteName}: ${Math.round(r.sifProbability * 100)}% SIF probability${rule}`,
    createdAt: r.createdAt, read: false,
  });
}
db.reports.forEach((r) => {
  db.audit[r.id] = [{ at: r.createdAt, byName: "SIF-Guard model", action: "auto_classified",
    detail: `Classified ${r.classification} (p=${r.sifProbability.toFixed(2)}, potential severity ${r.potentialSeverity})` }];
});
[...db.reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).filter((r) => r.sifProbability >= 0.85).forEach(notify);

// ── session ──
let session = null;
try {
  session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
} catch {
  session = null;
}
const publicUser = ({ password: _pw, ...u }) => u;
function requireUser() {
  if (!session) throw E.unauth();
  return session;
}
function requireRole(...roles) {
  const u = requireUser();
  if (!roles.includes(u.role)) throw E.forbidden();
  return u;
}
const scopeSite = (user, requested) => (user.role === "site_supervisor" ? user.siteId : requested || null);
function inScope(user, f = {}) {
  const site = scopeSite(user, f.siteId);
  return db.reports.filter(
    (r) => (!site || r.siteId === site)
      && (!f.from || r.reportedAt >= `${f.from}T00:00:00.000Z`)
      && (!f.to || r.reportedAt <= `${f.to}T23:59:59.999Z`),
  );
}

// ── auth ──
export async function login(email, password) {
  await wait(300);
  const u = db.users.find((x) => x.email === String(email).trim().toLowerCase());
  if (!u || u.password !== password) throw new ApiError(401, "UNAUTHENTICATED", "Invalid email or password");
  if (!u.active) throw new ApiError(403, "FORBIDDEN", "This account has been deactivated");
  session = publicUser(u);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export async function logout() {
  await wait(80);
  session = null;
  sessionStorage.removeItem(SESSION_KEY);
  return { ok: true };
}
export async function me() {
  await wait(120);
  return requireUser();
}
export async function registerUser(data) {
  await wait();
  requireRole("admin");
  const email = String(data.email || "").trim().toLowerCase();
  if (!data.name || !email || !data.password) throw E.validation("name, email and password are required");
  if (db.users.some((u) => u.email === email)) throw E.validation("Email already registered");
  if (data.role === "site_supervisor" && !data.siteId) throw E.validation("siteId: required for site_supervisor");
  const u = { id: `u${db.nextUser++}`, name: data.name, email, password: data.password, role: data.role,
    siteId: data.role === "site_supervisor" ? data.siteId : null, active: true };
  db.users.push(u);
  return publicUser(u);
}

// ── reports ──
export async function getReports(f = {}) {
  await wait();
  const user = requireUser();
  let items = inScope(user, f);
  if (f.classification) items = items.filter((r) => r.classification === f.classification);
  if (f.rule) items = items.filter((r) => r.lifeSavingRules.some((x) => x.rule === f.rule));
  if (f.barrier) items = items.filter((r) => r.barrierFailureType === f.barrier);
  if (f.status) items = items.filter((r) => r.status === f.status);
  if (f.batchId) items = items.filter((r) => r.batchId === f.batchId);
  if (f.q) {
    const q = String(f.q).toLowerCase();
    items = items.filter((r) => [r.text, r.id, r.activity, r.location, r.reportedBy].some((v) => (v || "").toLowerCase().includes(q)));
  }
  items = [...items].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  const page = Math.max(1, Number(f.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(f.limit) || 20));
  return { items: clone(items.slice((page - 1) * limit, page * limit)), total: items.length, page, limit };
}

export async function getReport(id) {
  await wait(150);
  const user = requireUser();
  const report = inScope(user).find((r) => r.id === id);
  if (!report) throw E.notFound(`Report ${id} not found`);
  return { report: clone(report), audit: clone(db.audit[id] || []) };
}

export async function submitReview(id, body) {
  await wait(300);
  const user = requireRole("admin", "hse_officer");
  const r = db.reports.find((x) => x.id === id);
  if (!r) throw E.notFound(`Report ${id} not found`);
  if (!["SIF", "NON_SIF"].includes(body.newClassification)) throw E.validation("newClassification: invalid");
  const before = r.classification;
  const original = r.review?.originalClassification || r.classification;
  r.classification = body.newClassification;
  if (body.newRules) r.lifeSavingRules = [...new Set(body.newRules)].filter((k) => RULES.includes(k)).map((rule) => ({ rule, confidence: 1 }));
  if (body.newBarrierFailureType) r.barrierFailureType = body.newBarrierFailureType;
  r.status = "reviewed";
  r.review = { by: user.id, byName: user.name, at: new Date().toISOString(), originalClassification: original,
    newClassification: r.classification, newRules: r.lifeSavingRules.map((x) => x.rule),
    newBarrierFailureType: r.barrierFailureType, note: body.note || "" };
  addAudit(id, user.name, "review", `classification ${before} -> ${r.classification}${body.note ? `; note: ${body.note}` : ""}`);
  db.pendingCorrections += 1;
  return clone(r);
}

// ── mock upload: tiny keyword classifier so demo uploads behave plausibly ──
const STRONG = ["without lockout", "without isolat", "still connected", "still live", "under the suspended load",
  "under suspended load", "without harness", "no harness", "without permit", "without hot work permit", "no gas test",
  "before atmospheric testing", "standby man was not present", "bypass", "interlock", "line of fire", "without bleeding",
  "overspeeding", "nearly hit", "jumpered", "inhibited", "no fall protection"];
const RULE_WORDS = {
  energy_isolation: ["lockout", "isolat", "energised", "live", "bleeding"],
  hot_work: ["weld", "grind", "hot work", "gas cutting", "spark"],
  confined_space: ["confined", "vessel", "manhole", "atmospheric", "standby man"],
  working_at_height: ["harness", "scaffold", "ladder", "monkey board", "height"],
  safe_mechanical_lifting: ["crane", "sling", "rigger", "suspended load", "lift"],
  line_of_fire: ["line of fire", "whip", "dropped", "in front of", "pressuris"],
  driving: ["driver", "vehicle", "tanker", "overspeed", "revers"],
  work_authorisation: ["permit", "authoris"],
  bypassing_safety_controls: ["bypass", "interlock", "inhibit", "jumper"],
};
const BARRIER_WORDS = [["isolation", ["lockout", "isolat", "live", "bleeding"]], ["ppe", ["harness", "glove", "goggle", "helmet"]],
  ["procedure", ["permit", "bypass", "gas test", "overspeed"]], ["supervision", ["standby", "banksman", "suspended load", "supervis"]],
  ["equipment", ["frayed", "faulty", "leak", "damaged", "broken"]], ["training", ["untrained", "trainee", "new joinee"]]];

function mockClassify(text) {
  const lower = text.toLowerCase();
  const hits = [];
  STRONG.forEach((w) => {
    const i = lower.indexOf(w);
    if (i >= 0 && !hits.some((h) => i < h.end && h.start < i + w.length)) hits.push({ start: i, end: i + w.length });
  });
  const rules = Object.entries(RULE_WORDS)
    .map(([rule, words]) => [rule, words.filter((w) => lower.includes(w)).length])
    .filter(([, n]) => n > 0)
    .map(([rule, n]) => ({ rule, confidence: Math.min(0.95, 0.5 + 0.15 * (n - 1)) }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  const p = Math.min(0.97, 0.15 + 0.35 * hits.length + 0.05 * rules.length);
  const sif = p >= 0.5;
  const barrier = sif ? (BARRIER_WORDS.find(([, ws]) => ws.some((x) => lower.includes(x))) || ["procedure"])[0] : "none";
  return {
    classification: sif ? "SIF" : "NON_SIF", sifProbability: Math.round(p * 100) / 100,
    confidence: Math.round((0.5 + Math.abs(p - 0.5)) * 100) / 100,
    highlightedPhrases: hits.sort((a, b) => a.start - b.start).map((h) => ({ text: text.slice(h.start, h.end), start: h.start, end: h.end, weight: 0.4 })),
    lifeSavingRules: rules, barrierFailureType: barrier,
    potentialSeverity: p >= 0.75 ? "fatal" : sif ? "serious" : "minor",
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const SITE_LOOKUP = new Map();
SITES.forEach((s) => [s.id, s.name, s.name.replace(/\s+(field|block)$/i, "")].forEach((k) => SITE_LOOKUP.set(k.toLowerCase(), s.id)));
const TYPE_LOOKUP = { ua: "UA", unsafe_act: "UA", uc: "UC", unsafe_condition: "UC", near_miss: "near_miss", nearmiss: "near_miss", incident: "incident" };

function parseDate(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 4, 0, 0));
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function uploadReports(file, onProgress) {
  const user = requireRole("admin", "hse_officer");
  if (!/\.csv$/i.test(file.name)) throw E.validation("Demo mode reads .csv files only; .xlsx needs the live backend.");
  for (let p = 0.25; p <= 1; p += 0.25) {
    await wait(140);
    onProgress?.(p);
  }
  await wait(400);
  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, "")).filter((r) => r.some((v) => v.trim() !== ""));
  if (rows.length < 2) throw E.validation("The file has no data rows");
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  if (!header.includes("text")) throw E.validation('Missing required column "text"');
  const batchId = `B-DEMO${Date.now().toString(36).toUpperCase()}`;
  const errors = [];
  const inserted = [];
  rows.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2;
    const d = Object.fromEntries(header.map((h, i) => [h, (cells[i] || "").trim()]));
    if (!d.text || d.text.length < 10) return errors.push({ row: rowNo, message: "text is required (min 10 characters)" });
    const siteId = SITE_LOOKUP.get((d.site || "").toLowerCase());
    if (!siteId) return errors.push({ row: rowNo, message: d.site ? `Unknown site "${d.site}"` : "site is required" });
    const reportType = TYPE_LOOKUP[(d.report_type || "").toLowerCase().replace(/[\s-]+/g, "_")];
    if (!reportType) return errors.push({ row: rowNo, message: "report_type must be UA, UC, near_miss or incident" });
    const reportedAt = parseDate(d.reported_at);
    if (!reportedAt) return errors.push({ row: rowNo, message: "reported_at must be ISO (2026-08-14) or DD/MM/YYYY" });
    const iso = reportedAt.toISOString();
    if (db.reports.some((r) => r.siteId === siteId && r.text === d.text && r.reportedAt === iso)) {
      return errors.push({ row: rowNo, message: "Duplicate: already stored" });
    }
    const language = /[\u0900-\u097F]/.test(d.text) ? "hi" : /[\u0980-\u09FF]/.test(d.text) ? "as" : "en";
    const ml = mockClassify(language === "en" ? d.text : "");
    if (language !== "en") ml.highlightedPhrases = [];
    const r = {
      id: `R-${db.nextId++}`, siteId, siteName: SITE_NAME[siteId], reportType, text: d.text, language,
      reportedAt: iso, activity: d.activity || "", location: d.location || "", reportedBy: d.reported_by || "",
      ...ml, status: "auto", review: null, createdAt: new Date().toISOString(), batchId,
    };
    db.reports.push(r);
    inserted.push(r);
    db.audit[r.id] = [];
    addAudit(r.id, "SIF-Guard model", "auto_classified", `Classified ${r.classification} (p=${r.sifProbability.toFixed(2)})`);
    if (r.sifProbability >= 0.85) notify(r);
  });
  void user;
  return {
    batchId, total: rows.length - 1, inserted: inserted.length,
    sifCount: inserted.filter((r) => r.classification === "SIF").length,
    skipped: rows.length - 1 - inserted.length, errors,
  };
}

// ── dashboard ──
export async function getSummary(f = {}) {
  await wait();
  const list = inScope(requireUser(), f);
  const sif = list.filter((r) => r.classification === "SIF").length;
  const last = list.map((r) => r.review?.at || r.createdAt).sort().at(-1) || null;
  return {
    totalReports: list.length, sifCount: sif, sifPercent: list.length ? Math.round((sif / list.length) * 1000) / 10 : 0,
    reviewedCount: list.filter((r) => r.status === "reviewed").length, lastUpdated: last,
  };
}

const mostCommon = (values) => {
  const counts = {};
  values.filter(Boolean).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

export async function getSiteRankings(f = {}) {
  await wait();
  const user = requireUser();
  const site = scopeSite(user, f.siteId);
  const list = inScope(user, f);
  const items = (site ? [site] : SITES.map((s) => s.id)).map((siteId) => {
    const rs = list.filter((r) => r.siteId === siteId);
    const sif = rs.filter((r) => r.classification === "SIF");
    return {
      siteId, siteName: SITE_NAME[siteId], totalReports: rs.length, sifCount: sif.length,
      sifDensity: rs.length ? Math.round((sif.length / rs.length) * 1000) / 1000 : 0, rank: 0,
      topRule: mostCommon(sif.flatMap((r) => r.lifeSavingRules.map((x) => x.rule))),
      topBarrier: mostCommon(sif.map((r) => r.barrierFailureType).filter((b) => b !== "none")),
    };
  });
  items.sort((a, b) => b.sifDensity - a.sifDensity || b.sifCount - a.sifCount);
  items.forEach((it, i) => { it.rank = i + 1; });
  return items;
}

export async function getTrends(f = {}) {
  await wait();
  const user = requireUser();
  const list = inScope(user, { siteId: f.siteId });
  const days = list.map((r) => r.reportedAt.slice(0, 10)).sort();
  const last = f.to || days.at(-1) || new Date().toISOString().slice(0, 10);
  let first = f.from || days[0] || last;
  const minFirst = new Date(Date.parse(`${last}T00:00:00Z`) - 13 * DAY).toISOString().slice(0, 10);
  if (!f.from && first > minFirst) first = minFirst;
  if (first > last) throw E.validation("from must be on or before to");
  const byDay = {};
  list.forEach((r) => {
    const d = r.reportedAt.slice(0, 10);
    byDay[d] ||= { total: 0, flagged: 0 };
    byDay[d].total += 1;
    if (r.classification === "SIF") byDay[d].flagged += 1;
  });
  const out = [];
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push({ date, total: byDay[date]?.total || 0, flagged: byDay[date]?.flagged || 0 });
  }
  return out;
}

export async function getRuleDistribution(f = {}) {
  await wait();
  const list = inScope(requireUser(), f);
  const counts = {};
  list.forEach((r) => r.lifeSavingRules.forEach((x) => { counts[x.rule] = (counts[x.rule] || 0) + 1; }));
  return RULES.map((rule) => ({ rule, count: counts[rule] || 0 })).sort((a, b) => b.count - a.count);
}

export async function getPatterns(f = {}) {
  await wait(300);
  const list = inScope(requireUser(), f);
  if (list.length < 5) return [];
  const groups = {};
  list.forEach((r) => {
    const rule = r.lifeSavingRules[0]?.rule;
    if (!rule) return;
    const key = `${r.activity}|${r.barrierFailureType}|${rule}`;
    (groups[key] ||= []).push(r);
  });
  return Object.entries(groups)
    .filter(([, m]) => m.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, m], i) => {
      const [activity, barrier, rule] = key.split("|");
      return {
        id: `C${i + 1}`,
        label: barrier !== "none" ? `${BARRIER_LABELS[barrier]} failure during ${activity.toLowerCase()}` : `${RULE_LABELS[rule]} precursors in ${activity.toLowerCase()}`,
        activity, location: mostCommon(m.map((r) => r.location)) || "", barrierFailureType: barrier, rule,
        count: m.length, siteIds: [...new Set(m.map((r) => r.siteId))], exampleReportIds: m.slice(0, 5).map((r) => r.id),
      };
    });
}

// ── export ──
export async function exportReport() {
  await wait(300);
  requireRole("admin", "hse_officer");
  throw new ApiError(501, "DEMO_MODE", "PDF/Excel export needs the live backend. Set VITE_USE_MOCK=false and run the server.");
}

// ── admin ──
export async function getUsers() {
  await wait();
  requireRole("admin");
  return db.users.map(publicUser);
}
export async function updateUser(id, patch) {
  await wait();
  const me_ = requireRole("admin");
  const u = db.users.find((x) => x.id === id);
  if (!u) throw E.notFound("User not found");
  if (u.id === me_.id && (patch.active === false || (patch.role && patch.role !== "admin"))) {
    throw E.validation("You cannot deactivate or demote your own admin account");
  }
  const role = patch.role ?? u.role;
  const siteId = patch.siteId !== undefined ? patch.siteId : u.siteId;
  if (role === "site_supervisor" && !siteId) throw E.validation("siteId is required for site_supervisor");
  u.role = role;
  u.siteId = role === "site_supervisor" ? siteId : null;
  if (patch.active !== undefined) u.active = patch.active;
  return publicUser(u);
}
export async function getModel() {
  await wait();
  requireRole("admin");
  return { ...db.model, pendingCorrections: db.pendingCorrections };
}
export async function retrain() {
  requireRole("admin");
  await wait(1500);
  const n = Number(db.model.modelVersion.split("v")[1]) + 1;
  const trainedOn = db.pendingCorrections;
  db.model = { ...db.model, modelVersion: `demo-v${n}`, lastTrainedAt: new Date().toISOString(), trainingSamples: db.model.trainingSamples + trainedOn };
  db.pendingCorrections = 0;
  return { status: "completed", trainedOn, modelVersion: db.model.modelVersion, metrics: { accuracy: db.model.accuracy, f1: db.model.f1 } };
}

// ── notifications ──
export async function getNotifications() {
  await wait(150);
  const user = requireUser();
  const site = scopeSite(user);
  return clone(db.notifications.filter((n) => !site || n.siteId === site).slice(0, 50));
}
export async function markNotificationRead(id) {
  await wait(80);
  requireUser();
  const n = db.notifications.find((x) => x.id === id);
  if (!n) throw E.notFound("Notification not found");
  n.read = true;
  return { notification: clone(n) };
}
