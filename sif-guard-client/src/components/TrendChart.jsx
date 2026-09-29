import { EmptyState } from "./ui";

// Stacked daily bars: grey = all reports, orange = SIF-flagged share of that day.
// Each column is `h-full` so percentage heights resolve (the old chart's zero-height bug).
export default function TrendChart({ daily = [] }) {
  if (!daily.length || daily.every((d) => d.total === 0)) return <EmptyState title="No reports in this period." />;
  const max = Math.max(...daily.map((d) => d.total), 1);
  const flagged = daily.reduce((s, d) => s + d.flagged, 0);
  const total = daily.reduce((s, d) => s + d.total, 0);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-28" role="img" aria-label={`${flagged} SIF-flagged of ${total} reports`}>
        {daily.map((d) => (
          <div key={d.date} className="flex-1 min-w-0 h-full flex flex-col justify-end" title={`${d.date}: ${d.flagged} SIF / ${d.total} total`}>
            <div className="w-full bg-text-muted/25 rounded-t-sm relative" style={{ height: `${(d.total / max) * 100}%` }}>
              <div
                className="absolute bottom-0 left-0 right-0 bg-signal-danger/80 rounded-t-sm"
                style={{ height: d.total ? `${(d.flagged / d.total) * 100}%` : 0 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mono text-xs text-text-muted mt-2">
        <span>{daily[0].date}</span>
        <span>{daily[daily.length - 1].date}</span>
      </div>
      <div className="flex flex-wrap gap-4 mono text-xs text-text-muted mt-2">
        <span><i className="inline-block w-2 h-2 bg-signal-danger/80 mr-1.5" />SIF-flagged ({flagged})</span>
        <span><i className="inline-block w-2 h-2 bg-text-muted/25 mr-1.5" />all reports ({total})</span>
      </div>
    </div>
  );
}
