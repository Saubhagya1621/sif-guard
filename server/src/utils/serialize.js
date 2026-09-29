// Convert DB documents into the exact contract shapes (§1). Nothing internal leaks out.
const iso = (d) => (d ? new Date(d).toISOString() : null);
const plain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);

function toReport(doc) {
  const r = plain(doc);
  return {
    id: r.id,
    siteId: r.siteId,
    siteName: r.siteName,
    reportType: r.reportType,
    text: r.text,
    language: r.language || 'en',
    reportedAt: iso(r.reportedAt),
    activity: r.activity || '',
    location: r.location || '',
    reportedBy: r.reportedBy || '',
    classification: r.classification,
    sifProbability: r.sifProbability,
    confidence: r.confidence,
    highlightedPhrases: (r.highlightedPhrases || []).map(({ text, start, end, weight }) => ({ text, start, end, weight })),
    lifeSavingRules: (r.lifeSavingRules || []).map(({ rule, confidence }) => ({ rule, confidence })),
    barrierFailureType: r.barrierFailureType || 'none',
    potentialSeverity: r.potentialSeverity,
    status: r.status || 'auto',
    review: r.review || null,
    createdAt: iso(r.createdAt),
  };
}

function toUser(doc) {
  const u = plain(doc);
  return { id: String(u._id), name: u.name, email: u.email, role: u.role, siteId: u.siteId ?? null, active: u.active !== false };
}

function toNotification(doc) {
  const n = plain(doc);
  return {
    id: String(n._id), reportId: n.reportId, siteId: n.siteId, message: n.message,
    sifProbability: n.sifProbability, createdAt: iso(n.createdAt), read: !!n.read,
  };
}

module.exports = { toReport, toUser, toNotification };
