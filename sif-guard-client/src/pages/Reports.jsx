import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import HighlightedText from "../components/HighlightedText";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getReport, getReports, submitReview } from "../api/reportsApi";
import {
  BARRIERS, REPORT_TYPE_LABELS, RULES, SEVERITY_LABELS, SITES, SITE_NAME, barrierLabel, canReview, ruleLabel,
} from "../lib/constants";
import { fmtDate, fmtDateTime, pct } from "../lib/format";
import {
  Chip, ClassBadge, EmptyState, ErrorState, Field, Label, Meter, PageHeader, SkeletonRows, btnCls, btnPrimaryCls, inputCls,
} from "../components/ui";

const PAGE_SIZE = 20;
const FILTER_KEYS = ["siteId", "classification", "rule", "barrier", "status", "from", "to", "q", "batchId"];

function Gauge({ label, value, tone }) {
  return (
    <div>
      <div className="flex justify-between mono text-xs text-text-muted mb-1">
        <span>{label}</span>
        <span className={tone === "danger" ? "text-signal-danger" : "text-text-primary"}>{pct(value)}</span>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  );
}

function AuditTrail({ state, onRetry }) {
  if (state.loading && !state.audit) return <SkeletonRows rows={2} />;
  if (state.error) return <ErrorState error={state.error} onRetry={onRetry} />;
  if (!state.audit?.length) return <p className="mono text-xs text-text-muted">No audit entries.</p>;
  return (
    <ol className="space-y-2 border-l border-border pl-3">
      {state.audit.map((a, i) => (
        <li key={`${a.at}-${i}`} className="text-xs">
          <div className="mono text-text-muted">
            {fmtDateTime(a.at)} · {a.byName} · <span className="text-text-primary">{a.action.replace(/_/g, " ")}</span>
          </div>
          <div className="text-text-muted mt-0.5 break-words">{a.detail}</div>
        </li>
      ))}
    </ol>
  );
}

function OverridePanel({ report, onSubmit }) {
  const [cls, setCls] = useState(report.classification === "SIF" ? "NON_SIF" : "SIF");
  const [rules, setRules] = useState(() => report.lifeSavingRules.map((r) => r.rule));
  const [barrier, setBarrier] = useState(report.barrierFailureType || "none");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleRule = (k) => setRules((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));

  async function submit() {
    setBusy(true);
    try {
      await onSubmit({
        newClassification: cls,
        newRules: rules,
        newBarrierFailureType: barrier,
        ...(note.trim() && { note: note.trim() }),
      });
      setConfirming(false);
      setNote("");
    } catch {
      /* toast shown by parent; keep the form as-is */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-border rounded-sm p-3 mt-4">
      <Label className="mb-2">Reviewer override</Label>
      <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="New classification">
        {["SIF", "NON_SIF"].map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cls === c}
            onClick={() => setCls(c)}
            className={`mono text-xs px-3 py-1 border rounded-sm transition-colors ${
              cls === c
                ? c === "SIF"
                  ? "border-signal-danger text-signal-danger bg-signal-danger/10"
                  : "border-signal-safe text-signal-safe bg-signal-safe/10"
                : "border-border text-text-muted hover:text-text-primary"
            }`}
          >
            {c === "SIF" ? "SIF-potential" : "Cleared (non-SIF)"}
          </button>
        ))}
      </div>

      <div className="mono text-[11px] text-text-muted mb-1.5 uppercase tracking-wide">Life-saving rules</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {RULES.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={rules.includes(k)}
            onClick={() => toggleRule(k)}
            className={`mono text-[11px] px-2 py-0.5 border rounded-sm transition-colors ${
              rules.includes(k) ? "border-signal-safe text-signal-safe" : "border-border text-text-muted hover:text-text-primary"
            }`}
          >
            {ruleLabel(k)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-3">
        <Field label="Barrier failure">
          <select value={barrier} onChange={(e) => setBarrier(e.target.value)} className={inputCls}>
            {BARRIERS.map((b) => (
              <option key={b} value={b}>{barrierLabel(b)}</option>
            ))}
          </select>
        </Field>
        <Field label="Note" className="flex-1 min-w-[200px]">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Why the model was wrong (optional)"
            className={`${inputCls} w-full`}
          />
        </Field>
      </div>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-xs text-text-muted">
            Save as {cls === "SIF" ? "SIF-potential" : "cleared"} and queue for retraining?
          </span>
          <button onClick={submit} disabled={busy} className={btnPrimaryCls}>
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button onClick={() => setConfirming(false)} disabled={busy} className={btnCls}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className={btnCls}>
          Apply override
        </button>
      )}
    </div>
  );
}

function ReportRow({ report, isOpen, onToggle, canOverride, onReview }) {
  const [detail, setDetail] = useState({ loading: false, audit: null, error: null });

  const loadAudit = useCallback(() => {
    setDetail((d) => ({ ...d, loading: true, error: null }));
    getReport(report.id)
      .then((r) => setDetail({ loading: false, audit: r.audit, error: null }))
      .catch((err) => setDetail({ loading: false, audit: null, error: err }));
  }, [report.id]);

  useEffect(() => {
    if (isOpen) loadAudit();
  }, [isOpen, loadAudit, report.status, report.review?.at]);

  const sif = report.classification === "SIF";

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 md:gap-4 py-3 text-left hover:bg-surface-raised/60 transition-colors px-3"
      >
        <ClassBadge classification={report.classification} />
        <span className="text-sm flex-1 truncate">{report.text}</span>
        {report.status === "reviewed" && <span className="mono text-[10px] text-signal-safe shrink-0 hidden sm:inline">REVIEWED</span>}
        <span className={`mono text-xs shrink-0 ${sif ? "text-signal-danger" : "text-text-muted"}`}>{pct(report.sifProbability)}</span>
        <span className="mono text-xs text-text-muted shrink-0 hidden lg:inline w-28 truncate">{report.siteName}</span>
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
            <div className="px-3 pb-5 pt-1 grid lg:grid-cols-[1.6fr_1fr] gap-6">
              <div>
                <p className="text-sm leading-relaxed mb-4" lang={report.language}>
                  <HighlightedText text={report.text} phrases={report.highlightedPhrases} />
                </p>
                {report.language !== "en" && (
                  <p className="mono text-[11px] text-text-muted mb-3">
                    {report.language === "hi" ? "Hindi" : "Assamese"} report · phrase highlights are shown for English text only
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <Gauge label="SIF probability" value={report.sifProbability} tone={sif ? "danger" : "safe"} />
                  <Gauge label="Model confidence" value={report.confidence} tone="muted" />
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {report.lifeSavingRules.map((r) => (
                    <Chip key={r.rule} title={`confidence ${pct(r.confidence)}`}>
                      {ruleLabel(r.rule)} · {pct(r.confidence)}
                    </Chip>
                  ))}
                  <Chip tone={report.barrierFailureType !== "none" ? "danger" : "muted"}>
                    Barrier: {barrierLabel(report.barrierFailureType)}
                  </Chip>
                  <Chip tone={report.potentialSeverity === "minor" ? "muted" : "danger"}>
                    {SEVERITY_LABELS[report.potentialSeverity] || report.potentialSeverity}
                  </Chip>
                </div>
                <div className="mono text-xs text-text-muted">
                  {REPORT_TYPE_LABELS[report.reportType] || report.reportType} · {report.activity || "—"}
                  {report.location ? ` · ${report.location}` : ""} · {report.siteName} · {fmtDate(report.reportedAt)}
                  {report.reportedBy ? ` · ${report.reportedBy}` : ""}
                </div>
                {report.review && (
                  <div className="mono text-xs text-signal-safe mt-3">
                    Reviewed by {report.review.byName} · {fmtDateTime(report.review.at)} · model said{" "}
                    {report.review.originalClassification === "SIF" ? "SIF" : "cleared"}
                    {report.review.note ? ` · “${report.review.note}”` : ""}
                  </div>
                )}
                {canOverride && <OverridePanel key={report.review?.at || "auto"} report={report} onSubmit={(body) => onReview(report, body)} />}
              </div>
              <div>
                <Label>Audit trail</Label>
                <AuditTrail state={detail} onRetry={loadAudit} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""])), [params]);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openParam = params.get("open");
  const [state, setState] = useState({ loading: true, error: null, items: [], total: 0 });
  const [openId, setOpenId] = useState(openParam);
  const [search, setSearch] = useState(filters.q);
  const [reloadKey, setReloadKey] = useState(0);
  const isSupervisor = user.role === "site_supervisor";
  const canOverride = canReview(user);

  const update = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => (v === "" || v == null ? next.delete(k) : next.set(k, v)));
          if (!("page" in patch)) next.delete("page");
          next.delete("open");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (openParam) setOpenId(openParam);
  }, [openParam]);

  // debounced search
  useEffect(() => {
    if (search === filters.q) return undefined;
    const t = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(t);
  }, [search, filters.q, update]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getReports({ ...query, page, limit: PAGE_SIZE })
      .then((res) => !cancelled && setState({ loading: false, error: null, items: res.items, total: res.total }))
      .catch((err) => !cancelled && setState({ loading: false, error: err, items: [], total: 0 }));
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadKey]);

  const replaceReport = (r) => setState((s) => ({ ...s, items: s.items.map((x) => (x.id === r.id ? r : x)) }));

  async function handleReview(report, body) {
    // optimistic update, rolled back on error
    replaceReport({
      ...report,
      classification: body.newClassification,
      lifeSavingRules: body.newRules.map((rule) => ({ rule, confidence: 1 })),
      barrierFailureType: body.newBarrierFailureType,
      status: "reviewed",
    });
    try {
      const saved = await submitReview(report.id, body);
      replaceReport(saved);
      toast.success(`${report.id} saved as ${saved.classification === "SIF" ? "SIF-potential" : "cleared"} · queued for retraining`);
    } catch (err) {
      replaceReport(report);
      toast.error(err.message || "Override failed");
      throw err;
    }
  }

  const activeFilters = FILTER_KEYS.filter((k) => filters[k] && !(isSupervisor && k === "siteId"));
  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const clearAll = () => {
    setSearch("");
    setParams({}, { replace: true });
  };

  return (
    <Layout>
      <PageHeader
        title="Classification results"
        subtitle={state.loading && !state.items.length ? "Loading…" : `${state.total} report${state.total === 1 ? "" : "s"}${activeFilters.length ? " match these filters" : ""}`}
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Field label="Search" className="flex-1 min-w-[200px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Text, report ID, activity, location…"
            className={`${inputCls} w-full`}
          />
        </Field>
        {isSupervisor ? (
          <Field label="Site">
            <span className="mono text-xs px-3 py-2 border border-border rounded-sm text-text-muted">{SITE_NAME[user.siteId]} (your site)</span>
          </Field>
        ) : (
          <Field label="Site">
            <select value={filters.siteId} onChange={(e) => update({ siteId: e.target.value })} className={inputCls}>
              <option value="">All sites</option>
              {SITES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Classification">
          <select value={filters.classification} onChange={(e) => update({ classification: e.target.value })} className={inputCls}>
            <option value="">All</option>
            <option value="SIF">SIF-potential</option>
            <option value="NON_SIF">Cleared</option>
          </select>
        </Field>
        <Field label="Rule">
          <select value={filters.rule} onChange={(e) => update({ rule: e.target.value })} className={inputCls}>
            <option value="">All rules</option>
            {RULES.map((k) => (
              <option key={k} value={k}>{ruleLabel(k)}</option>
            ))}
          </select>
        </Field>
        <Field label="Barrier">
          <select value={filters.barrier} onChange={(e) => update({ barrier: e.target.value })} className={inputCls}>
            <option value="">All barriers</option>
            {BARRIERS.map((b) => (
              <option key={b} value={b}>{barrierLabel(b)}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={filters.status} onChange={(e) => update({ status: e.target.value })} className={inputCls}>
            <option value="">Any</option>
            <option value="auto">Auto-classified</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} className={inputCls} />
        </Field>
        <Field label="To">
          <input type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} className={inputCls} />
        </Field>
        {activeFilters.length > 0 && (
          <button onClick={clearAll} className={btnCls}>
            Clear filters
          </button>
        )}
      </div>

      {filters.batchId && (
        <div className="mb-4">
          <button onClick={() => update({ batchId: "" })} className="mono text-xs px-2 py-1 border border-signal-safe/60 text-signal-safe rounded-sm">
            Upload batch {filters.batchId} ×
          </button>
        </div>
      )}

      <div className={`panel transition-opacity ${state.loading && state.items.length ? "opacity-60" : ""}`}>
        {state.loading && !state.items.length ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : state.items.length === 0 ? (
          <EmptyState title="No reports match these filters." hint="Try clearing a filter or widening the date range.">
            {activeFilters.length > 0 && (
              <button onClick={clearAll} className={btnCls}>
                Clear filters
              </button>
            )}
          </EmptyState>
        ) : (
          state.items.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              isOpen={openId === r.id}
              onToggle={() => setOpenId(openId === r.id ? null : r.id)}
              canOverride={canOverride}
              onReview={handleReview}
            />
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => update({ page: String(page - 1) })} disabled={page <= 1} className={btnCls}>
            ‹ Prev
          </button>
          <span className="mono text-xs text-text-muted">
            Page {page} of {pages}
          </span>
          <button onClick={() => update({ page: String(page + 1) })} disabled={page >= pages} className={btnCls}>
            Next ›
          </button>
        </div>
      )}
    </Layout>
  );
}
