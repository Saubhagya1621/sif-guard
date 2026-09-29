const { z } = require('zod');
const { E } = require('./errors');
const { parseDateParam } = require('./dates');

// Parse with zod and convert failures into a contract VALIDATION_ERROR.
function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw E.validation(r.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
  }
  return r.data;
}

// Drop empty query params (?siteId=) so optional enums don't fail.
const clean = (obj = {}) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

const dateStr = z.string().refine((v) => parseDateParam(v) instanceof Date, 'must be a date (YYYY-MM-DD or ISO)');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { z, parse, clean, dateStr, escapeRegex };
