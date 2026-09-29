// Mock API layer, shaped exactly like the real Node/Express + FastAPI
// contract in the build spec (Section 3). Every function here returns the
// same shape the live endpoints will return, so wiring real `fetch` calls
// later is a one-line swap per function, not a rewrite of the pages.

import { REPORTS, SITES } from "../data/fixtures";

const delay = (ms = 250) => new Promise((res) => setTimeout(res, ms));

// GET /api/reports?site=&classification=&dateFrom=&dateTo=
export async function getReports(filters = {}) {
  await delay();
  let results = [...REPORTS];
  if (filters.site) results = results.filter((r) => r.site === filters.site);
  if (filters.classification) {
    const wantSif = filters.classification === "sif";
    results = results.filter((r) => r.isSifPotential === wantSif);
  }
  return results.sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
}

// GET /api/reports/:id
export async function getReport(id) {
  await delay(150);
  return REPORTS.find((r) => r.id === id) ?? null;
}

// PATCH /api/reports/:id/review
export async function submitReview(id, { correctedClassification, notes }) {
  await delay(300);
  const report = REPORTS.find((r) => r.id === id);
  if (report) {
    report.reviewerOverride = { reviewed: true, correctedClassification, notes };
  }
  return report;
}

// GET /api/dashboard/sites — sites ranked by SIF-precursor density
export async function getSiteRankings() {
  await delay();
  return SITES.map((site) => {
    const siteReports = REPORTS.filter((r) => r.site === site.id);
    const sifCount = siteReports.filter((r) => r.isSifPotential).length;
    const density = siteReports.length ? sifCount / siteReports.length : 0;
    return {
      ...site,
      totalReports: siteReports.length,
      sifCount,
      sifPrecursorDensity: density,
    };
  }).sort((a, b) => b.sifPrecursorDensity - a.sifPrecursorDensity);
}

// GET /api/dashboard/patterns — recurring activity/barrier-failure clusters
export async function getPatterns() {
  await delay();
  const map = new Map();
  REPORTS.filter((r) => r.isSifPotential).forEach((r) => {
    const key = `${r.activity} + ${r.barrierFailureType || "Unclassified"}`;
    if (!map.has(key)) {
      map.set(key, { activity: r.activity, barrierFailureType: r.barrierFailureType, count: 0, sites: new Set() });
    }
    const entry = map.get(key);
    entry.count += 1;
    entry.sites.add(r.site);
  });
  return [...map.values()]
    .map((p) => ({ ...p, sites: [...p.sites] }))
    .filter((p) => p.count > 1)
    .sort((a, b) => b.count - a.count);
}

// GET /api/dashboard/trends — time-series SIF counts
export async function getTrends() {
  await delay();
  const byDate = new Map();
  REPORTS.forEach((r) => {
    if (!byDate.has(r.reportDate)) byDate.set(r.reportDate, { date: r.reportDate, sif: 0, total: 0 });
    const entry = byDate.get(r.reportDate);
    entry.total += 1;
    if (r.isSifPotential) entry.sif += 1;
  });
  return [...byDate.values()].sort((a, b) => (a.date > b.date ? 1 : -1));
}

// POST /api/reports/upload — bulk CSV/Excel upload
export async function uploadReports(fileName, rowCount = 20) {
  // Simulated progressive ingestion — the real endpoint streams progress
  // over the same shape via SSE/polling; this mimics that with a callback.
  return { fileName, rowCount, status: "queued" };
}
