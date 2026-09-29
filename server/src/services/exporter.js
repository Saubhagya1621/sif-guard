// Weekly intervention-priority list as PDF (print-friendly) or Excel.
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { RULE_LABELS, BARRIER_LABELS, REPORT_TYPE_LABELS } = require('../config/constants');

const ruleLabel = (k) => (k ? RULE_LABELS[k] || k : '-');
const barrierLabel = (k) => (k ? BARRIER_LABELS[k] || k : '-');
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const fmtDateTime = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

// ── PDF ──
function table(doc, columns, rows) {
  const x0 = doc.page.margins.left;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const pad = 4;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  const header = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111');
    let x = x0;
    columns.forEach((c) => { doc.text(c.header, x + 2, y + pad, { width: c.width - 4, align: c.align || 'left' }); x += c.width; });
    doc.moveTo(x0, y + 18).lineTo(x0 + totalW, y + 18).lineWidth(0.8).strokeColor('#333').stroke();
    doc.y = y + 20;
    doc.font('Helvetica').fontSize(8);
  };

  header();
  rows.forEach((r, i) => {
    const h = Math.max(...columns.map((c, j) => doc.heightOfString(String(r[j] ?? ''), { width: c.width - 4 }))) + pad * 2;
    if (doc.y + h > bottom()) { doc.addPage(); header(); }
    const y = doc.y;
    if (i % 2 === 0) doc.rect(x0, y, totalW, h).fill('#f1f2ef');
    doc.fillColor('#111');
    let x = x0;
    columns.forEach((c, j) => { doc.text(String(r[j] ?? ''), x + 2, y + pad, { width: c.width - 4, align: c.align || 'left' }); x += c.width; });
    doc.y = y + h;
  });
  doc.x = x0;
  doc.moveDown(0.8);
}

function heading(doc, text) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.4).font('Helvetica-Bold').fontSize(12).fillColor('#111').text(text, doc.page.margins.left);
  doc.moveDown(0.3);
}

function buildPdf(data, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'SIF-Guard Intervention Priority List', Author: 'SIF-Guard' } });
  doc.pipe(stream);

  doc.font('Helvetica-Bold').fontSize(17).fillColor('#111').text('SIF-Guard: Weekly Intervention Priority List');
  doc.moveDown(0.2).font('Helvetica').fontSize(9).fillColor('#444')
    .text(`Oil India Limited · Period ${data.from} to ${data.to} · Generated ${fmtDateTime(data.generatedAt)} by ${data.generatedBy}`);
  doc.moveDown(0.5).fontSize(10).fillColor('#111')
    .text(`Reports: ${data.summary.totalReports}    SIF-potential: ${data.summary.sifCount} (${data.summary.sifPercent}%)    Reviewed: ${data.summary.reviewedCount}`);

  heading(doc, '1. Sites ranked by SIF-precursor density');
  table(doc, [
    { header: '#', width: 25, align: 'right' }, { header: 'Site', width: 110 }, { header: 'Reports', width: 55, align: 'right' },
    { header: 'SIF', width: 45, align: 'right' }, { header: 'Density', width: 60, align: 'right' },
    { header: 'Top rule', width: 120 }, { header: 'Top barrier failure', width: 100 },
  ], data.sites.map((s) => [s.rank, s.siteName, s.totalReports, s.sifCount, pct(s.sifDensity), ruleLabel(s.topRule), barrierLabel(s.topBarrier)]));

  heading(doc, '2. Recurring precursor patterns');
  if (!data.patterns.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#444').text(data.patternsNote || 'No recurring patterns found in this period.');
    doc.moveDown(0.8);
  } else {
    table(doc, [
      { header: '#', width: 25, align: 'right' }, { header: 'Pattern', width: 185 }, { header: 'Activity', width: 90 },
      { header: 'Rule', width: 95 }, { header: 'Count', width: 40, align: 'right' }, { header: 'Sites', width: 80 },
    ], data.patterns.map((p, i) => [i + 1, p.label, p.activity, ruleLabel(p.rule), p.count, p.siteIds.join(', ')]));
  }

  heading(doc, '3. Top SIF-potential reports (intervene first)');
  if (!data.topReports.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#444').text('No SIF-potential reports in this period.');
  } else {
    table(doc, [
      { header: 'ID', width: 45 }, { header: 'Site', width: 75 }, { header: 'Date', width: 55 },
      { header: 'SIF p', width: 40, align: 'right' }, { header: 'Rule', width: 95 }, { header: 'Barrier', width: 55 }, { header: 'Summary', width: 150 },
    ], data.topReports.map((r) => [
      r.id, r.siteName, r.reportedAt.slice(0, 10), pct(r.sifProbability), ruleLabel(r.lifeSavingRules[0]?.rule), barrierLabel(r.barrierFailureType),
      // Built-in PDF fonts can't render Devanagari/Assamese; full text is in the Excel export.
      r.language === 'en' ? truncate(r.text, 160) : `(${r.language} report; see Excel export for original text)`,
    ]));
  }
  doc.end();
}

// ── Excel ──
async function buildXlsx(data, stream) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIF-Guard';
  wb.created = new Date(data.generatedAt);

  const addSheet = (name, columns, rows) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns;
    ws.addRows(rows);
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1310' } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    return ws;
  };

  addSheet('Summary', [{ header: 'Field', key: 'k', width: 24 }, { header: 'Value', key: 'v', width: 40 }], [
    { k: 'Period', v: `${data.from} to ${data.to}` },
    { k: 'Generated', v: `${fmtDateTime(data.generatedAt)} by ${data.generatedBy}` },
    { k: 'Total reports', v: data.summary.totalReports },
    { k: 'SIF-potential', v: data.summary.sifCount },
    { k: 'SIF %', v: `${data.summary.sifPercent}%` },
    { k: 'Reviewed', v: data.summary.reviewedCount },
  ]);

  addSheet('Sites', [
    { header: 'Rank', key: 'rank', width: 7 }, { header: 'Site', key: 'siteName', width: 20 },
    { header: 'Reports', key: 'totalReports', width: 10 }, { header: 'SIF', key: 'sifCount', width: 8 },
    { header: 'SIF density', key: 'sifDensity', width: 12, style: { numFmt: '0.0%' } },
    { header: 'Top rule', key: 'topRule', width: 28 }, { header: 'Top barrier failure', key: 'topBarrier', width: 20 },
  ], data.sites.map((s) => ({ ...s, topRule: ruleLabel(s.topRule), topBarrier: barrierLabel(s.topBarrier) })));

  const patterns = addSheet('Patterns', [
    { header: 'Pattern', key: 'label', width: 45 }, { header: 'Activity', key: 'activity', width: 22 },
    { header: 'Location', key: 'location', width: 18 }, { header: 'Rule', key: 'rule', width: 26 },
    { header: 'Barrier', key: 'barrier', width: 14 }, { header: 'Count', key: 'count', width: 8 },
    { header: 'Sites', key: 'sites', width: 30 }, { header: 'Example reports', key: 'examples', width: 30 },
  ], data.patterns.map((p) => ({
    ...p, rule: ruleLabel(p.rule), barrier: barrierLabel(p.barrierFailureType), sites: p.siteIds.join(', '), examples: p.exampleReportIds.join(', '),
  })));
  if (data.patternsNote) patterns.addRow({ label: data.patternsNote });

  const top = addSheet('Top Reports', [
    { header: 'ID', key: 'id', width: 10 }, { header: 'Site', key: 'siteName', width: 18 },
    { header: 'Reported at', key: 'reportedAt', width: 18 }, { header: 'Type', key: 'type', width: 16 },
    { header: 'SIF probability', key: 'sifProbability', width: 14, style: { numFmt: '0%' } },
    { header: 'Confidence', key: 'confidence', width: 12, style: { numFmt: '0%' } },
    { header: 'Potential severity', key: 'potentialSeverity', width: 16 }, { header: 'Rules', key: 'rules', width: 34 },
    { header: 'Barrier', key: 'barrier', width: 14 }, { header: 'Activity', key: 'activity', width: 20 },
    { header: 'Location', key: 'location', width: 18 }, { header: 'Status', key: 'status', width: 10 },
    { header: 'Text', key: 'text', width: 80 },
  ], data.topReports.map((r) => ({
    ...r, reportedAt: new Date(r.reportedAt), type: REPORT_TYPE_LABELS[r.reportType] || r.reportType,
    rules: r.lifeSavingRules.map((x) => ruleLabel(x.rule)).join(', '), barrier: barrierLabel(r.barrierFailureType),
  })));
  top.getColumn('reportedAt').numFmt = 'yyyy-mm-dd hh:mm';
  top.getColumn('text').alignment = { wrapText: true, vertical: 'top' };

  await wb.xlsx.write(stream);
}

module.exports = { buildPdf, buildXlsx };
