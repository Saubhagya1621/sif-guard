import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { SITES } from "../data/fixtures";
import { getReports, submitReview } from "../api/reportsApi";

function ReportRow({ report, isOpen, onToggle, onOverride }) {
  const [note, setNote] = useState("");

  function renderHighlighted() {
    if (!report.highlightedPhrases.length) return report.rawText;
    let parts = [report.rawText];
    report.highlightedPhrases.forEach((phrase) => {
      parts = parts.flatMap((part) =>
        typeof part === "string" ? part.split(phrase).flatMap((p, i, arr) => (i < arr.length - 1 ? [p, phrase] : [p])) : [part]
      );
    });
    return parts.map((part, i) =>
      report.highlightedPhrases.includes(part) ? (
        <span key={i} className="bg-signal-danger/20 text-signal-danger">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 py-3 text-left hover:bg-surface-raised/60 transition-colors px-2"
      >
        <span
          className={`mono text-xs px-2 py-0.5 rounded-sm shrink-0 ${
            report.isSifPotential ? "bg-signal-danger/15 text-signal-danger" : "bg-signal-safe/15 text-signal-safe"
          }`}
        >
          {report.isSifPotential ? "SIF" : "CLEARED"}
        </span>
        <span className="text-sm flex-1 truncate">{report.rawText}</span>
        <span className="mono text-xs text-text-muted shrink-0">
          {Math.round(report.confidenceScore * 100)}%
        </span>
        <span className="mono text-xs text-text-muted shrink-0 hidden md:inline">{report.id}</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-4 pt-1">
              <p className="text-sm leading-relaxed mb-3">{renderHighlighted()}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {report.lifeSavingRuleTags.map((tag) => (
                  <span key={tag} className="mono text-xs px-2 py-0.5 border border-border rounded-sm text-text-muted">
                    {tag}
                  </span>
                ))}
                {report.barrierFailureType && (
                  <span className="mono text-xs px-2 py-0.5 border border-border rounded-sm text-text-muted">
                    Barrier: {report.barrierFailureType}
                  </span>
                )}
              </div>
              <div className="mono text-xs text-text-muted mb-3">
                {report.activity} · {SITES.find((s) => s.id === report.site)?.name} · {report.reportDate}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reviewer note (optional)"
                  className="flex-1 bg-surface-raised border border-border rounded-sm px-2 py-1.5 text-sm outline-none focus:border-signal-safe"
                />
                <button
                  onClick={() => onOverride(report.id, !report.isSifPotential, note)}
                  className="mono text-xs px-3 py-1.5 border border-border rounded-sm hover:border-signal-safe transition-colors shrink-0"
                >
                  Override to {report.isSifPotential ? "cleared" : "SIF"}
                </button>
              </div>
              {report.reviewerOverride?.reviewed && (
                <div className="mono text-xs text-signal-safe mt-2">Reviewer correction recorded.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [params, setParams] = useSearchParams();
  const site = params.get("site") || "";
  const classification = params.get("classification") || "";
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    getReports({ site, classification }).then(setReports);
  }, [site, classification]);

  async function handleOverride(id, correctedClassification, notes) {
    await submitReview(id, { correctedClassification, notes });
    setReports(await getReports({ site, classification }));
    setFlash(id);
    setTimeout(() => setFlash(null), 800);
  }

  return (
    <Layout>
      <h1 className="text-xl font-medium mb-1">Classification results</h1>
      <p className="text-text-muted text-sm mb-6">{reports.length} reports</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={site}
          onChange={(e) => setParams({ ...(classification && { classification }), ...(e.target.value && { site: e.target.value }) })}
          className="bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm outline-none focus:border-signal-safe"
        >
          <option value="">All sites</option>
          {SITES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={classification}
          onChange={(e) => setParams({ ...(site && { site }), ...(e.target.value && { classification: e.target.value }) })}
          className="bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm outline-none focus:border-signal-safe"
        >
          <option value="">All classifications</option>
          <option value="sif">SIF-potential</option>
          <option value="cleared">Cleared</option>
        </select>
      </div>

      <div className="panel">
        {reports.length === 0 ? (
          <p className="mono text-sm text-text-muted p-6">No reports match these filters.</p>
        ) : (
          reports.map((r) => (
            <motion.div
              key={r.id}
              animate={flash === r.id ? { backgroundColor: ["rgba(62,213,152,0.15)", "rgba(0,0,0,0)"] } : {}}
              transition={{ duration: 0.8 }}
            >
              <ReportRow
                report={r}
                isOpen={openId === r.id}
                onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                onOverride={handleOverride}
              />
            </motion.div>
          ))
        )}
      </div>
    </Layout>
  );
}
