import { useState } from "react";
import Layout from "../components/Layout";
import { useToast } from "../context/ToastContext";
import { exportReport } from "../api/reportsApi";
import { USE_MOCK } from "../api/client";
import { daysAgo, isoDay } from "../lib/format";
import { ErrorState, Field, PageHeader, btnCls, btnPrimaryCls, inputCls } from "../components/ui";

const RANGES = [
  ["Last 7 days", 6],
  ["Last 30 days", 29],
  ["Last 90 days", 89],
];

export default function Export() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(isoDay());
  const [format, setFormat] = useState("pdf");
  const [state, setState] = useState({ busy: false, error: null, last: null });

  async function handleGenerate(e) {
    e.preventDefault();
    if (from > to) {
      setState({ busy: false, error: { code: "VALIDATION_ERROR", message: "From must be on or before To." }, last: null });
      return;
    }
    setState({ busy: true, error: null, last: null });
    try {
      const name = await exportReport({ format, from, to });
      setState({ busy: false, error: null, last: name });
      toast.success(`Downloaded ${name}`);
    } catch (error) {
      setState({ busy: false, error, last: null });
    }
  }

  return (
    <Layout>
      <PageHeader title="Intervention-priority export" subtitle="Weekly list: sites ranked by SIF density, top recurring patterns and the highest-risk reports." />

      <form onSubmit={handleGenerate} className="panel p-5 max-w-md space-y-4">
        <div className="flex flex-wrap gap-2">
          {RANGES.map(([label, n]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFrom(daysAgo(n));
                setTo(isoDay());
              }}
              className={btnCls}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full`} />
          </Field>
          <Field label="To">
            <input type="date" required value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full`} />
          </Field>
        </div>
        <fieldset>
          <legend className="mono text-[11px] text-text-muted uppercase tracking-wide mb-2">Format</legend>
          <div className="flex gap-2">
            {[
              ["pdf", "PDF"],
              ["xlsx", "Excel"],
            ].map(([value, label]) => (
              <label
                key={value}
                className={`mono text-xs px-3 py-1.5 border rounded-sm cursor-pointer transition-colors ${
                  format === value ? "border-signal-safe text-signal-safe" : "border-border text-text-muted hover:text-text-primary"
                }`}
              >
                <input type="radio" name="format" value={value} checked={format === value} onChange={() => setFormat(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={state.busy} className={btnPrimaryCls}>
          {state.busy ? "Generating…" : "Generate report"}
        </button>
        {state.last && <p className="mono text-xs text-signal-safe">Downloaded {state.last}</p>}
        {state.error && <ErrorState error={state.error} />}
        {USE_MOCK && <p className="mono text-[11px] text-text-muted">Demo mode: file export needs the live backend.</p>}
      </form>
    </Layout>
  );
}
