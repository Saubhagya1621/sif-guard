// Reads uploaded CSV/XLSX files and validates each row against the contract's upload columns.
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { SITES, LANGUAGES } = require('../config/constants');
const { DAY } = require('../utils/dates');
const { E } = require('../utils/errors');

const MAX_ROWS = 5000;

const HEADER_ALIASES = {
  id: 'report_id', reportid: 'report_id', site_id: 'site', site_name: 'site', type: 'report_type',
  reporttype: 'report_type', date: 'reported_at', reportedat: 'reported_at', reported_on: 'reported_at',
  description: 'text', report_text: 'text', observation: 'text', reporter: 'reported_by',
  reportedby: 'reported_by', lang: 'language',
};
const normHeader = (h) => {
  const k = String(h ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[k] || k;
};

// Site may be given as id ("moran"), full name ("Moran Field") or short name ("Moran").
const SITE_LOOKUP = new Map();
for (const s of SITES) {
  [s.id, s.name, s.name.replace(/\s+(field|block)$/i, '')].forEach((k) => SITE_LOOKUP.set(k.toLowerCase(), s.id));
}
SITE_LOOKUP.set('naharkatia', 'naharkatiya');

const TYPE_LOOKUP = {
  ua: 'UA', unsafe_act: 'UA', uc: 'UC', unsafe_condition: 'UC',
  near_miss: 'near_miss', nearmiss: 'near_miss', incident: 'incident',
};

function cellValue(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return v.result ?? '';
    if (v.text) return String(v.text);
    return '';
  }
  return v;
}

async function readRows(file) {
  const name = (file.originalname || '').toLowerCase();
  let rows;
  if (name.endsWith('.csv')) {
    let records;
    try {
      records = parse(file.buffer, {
        bom: true, columns: (header) => header.map(normHeader), skip_empty_lines: true,
        relax_column_count: true, trim: true, info: true,
      });
    } catch (err) {
      throw E.validation(`Could not parse CSV: ${err.message}`);
    }
    rows = records.map(({ record, info }) => ({ row: info.lines, data: record }));
  } else if (name.endsWith('.xlsx')) {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(file.buffer); } catch { throw E.validation('Could not read the Excel file; is it a valid .xlsx?'); }
    const ws = wb.worksheets[0];
    if (!ws) throw E.validation('The Excel file has no worksheets');
    const headers = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = normHeader(cellValue(cell)); });
    rows = [];
    ws.eachRow((r, n) => {
      if (n === 1) return;
      const data = {};
      let filled = false;
      headers.forEach((h, col) => {
        if (!h) return;
        const v = cellValue(r.getCell(col));
        data[h] = v;
        if (v !== '' && v != null) filled = true;
      });
      if (filled) rows.push({ row: n, data });
    });
  } else {
    throw E.validation('Only .csv and .xlsx files are supported');
  }
  if (!rows.length) throw E.validation('The file has no data rows');
  if (rows.length > MAX_ROWS) throw E.validation(`Too many rows (${rows.length}); the limit is ${MAX_ROWS} per upload`);
  if (!('text' in rows[0].data)) throw E.validation('Missing required column "text"');
  return rows;
}

// Accepts Date objects, Excel serials, ISO strings, and DD/MM/YYYY [HH:mm[:ss]] (interpreted as UTC).
function parseReportedAt(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * DAY));
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', se = '0'] = m;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se));
    return dt.getUTCDate() === +d && dt.getUTCMonth() === +mo - 1 ? dt : null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

// Script-based detection: Devanagari → hi, Bengali-Assamese → as, else en.
function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'as';
  return 'en';
}

const dedupeKey = (siteId, reportedAt, text) => crypto.createHash('sha1')
  .update(`${siteId}|${reportedAt.toISOString()}|${text.toLowerCase().replace(/\s+/g, ' ')}`)
  .digest('hex');

const clip = (v) => String(v ?? '').trim().slice(0, 200);

function normalizeRow({ row, data }) {
  const fail = (message) => ({ row, error: message });

  const text = String(data.text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!text) return fail('text is required');
  if (text.length < 10) return fail('text is too short (min 10 characters)');
  if (text.length > 5000) return fail('text is too long (max 5000 characters)');

  const siteRaw = clip(data.site);
  const siteId = SITE_LOOKUP.get(siteRaw.toLowerCase());
  if (!siteId) return fail(siteRaw ? `Unknown site "${siteRaw}"` : 'site is required');

  const typeRaw = clip(data.report_type);
  const reportType = TYPE_LOOKUP[typeRaw.toLowerCase().replace(/[\s-]+/g, '_')];
  if (!reportType) return fail(typeRaw ? `Unknown report_type "${typeRaw}" (use UA, UC, near_miss or incident)` : 'report_type is required');

  const reportedAt = parseReportedAt(data.reported_at);
  if (!reportedAt) return fail('reported_at must be ISO (2026-08-14) or DD/MM/YYYY');
  if (reportedAt.getTime() > Date.now() + DAY) return fail('reported_at is in the future');

  const id = clip(data.report_id);
  if (id && !/^R-\d+$/.test(id)) return fail('report_id must look like R-1234 (or be left empty)');

  const lang = clip(data.language).toLowerCase();
  return {
    row,
    value: {
      id: id || null,
      siteId,
      reportType,
      reportedAt,
      text,
      language: LANGUAGES.includes(lang) ? lang : detectLanguage(text),
      activity: clip(data.activity),
      location: clip(data.location),
      reportedBy: clip(data.reported_by),
      dedupeKey: dedupeKey(siteId, reportedAt, text),
    },
  };
}

module.exports = { readRows, normalizeRow, dedupeKey, detectLanguage, parseReportedAt };
