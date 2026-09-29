import { useNavigate } from "react-router-dom";
import { EmptyState } from "./ui";
import { ruleLabel } from "../lib/constants";

// Recurring precursor patterns from HDBSCAN (/dashboard/patterns). Click → Reports filtered to that pattern.
export default function PatternList({ items = [], limit = 6 }) {
  const navigate = useNavigate();
  if (!items.length) return <EmptyState title="No recurring patterns yet." hint="Patterns appear once 5+ reports share a failure mode." />;

  function open(p) {
    const q = new URLSearchParams();
    if (p.rule) q.set("rule", p.rule);
    if (p.barrierFailureType && p.barrierFailureType !== "none") q.set("barrier", p.barrierFailureType);
    navigate(`/reports?${q.toString()}`);
  }

  return (
    <div className="space-y-3">
      {items.slice(0, limit).map((p) => (
        <button
          key={p.id}
          onClick={() => open(p)}
          className="w-full text-left text-sm border-l-2 border-signal-danger/60 hover:border-signal-danger pl-3 transition-colors"
        >
          <div>{p.label}</div>
          <div className="mono text-xs text-text-muted mt-0.5">
            <span className="text-signal-danger">{p.count} reports</span> · {p.siteIds.length} site{p.siteIds.length === 1 ? "" : "s"}
            {p.location ? ` · ${p.location}` : ""}
            {p.rule ? ` · ${ruleLabel(p.rule)}` : ""}
          </div>
        </button>
      ))}
    </div>
  );
}
