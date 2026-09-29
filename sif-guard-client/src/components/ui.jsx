// Shared instrument-panel UI pieces (same tokens as index.css: panel, mono, hairline borders, signal colors).
export const inputCls =
  "bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm outline-none focus:border-signal-safe disabled:opacity-50";
export const btnCls =
  "mono text-xs px-3 py-1.5 border border-border rounded-sm hover:border-signal-safe transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimaryCls =
  "mono text-xs px-3 py-1.5 bg-signal-safe text-bg-base rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";
export const btnDangerCls =
  "mono text-xs px-3 py-1.5 border border-signal-danger/70 text-signal-danger rounded-sm hover:bg-signal-danger hover:text-bg-base transition-colors disabled:opacity-50";

export function Label({ children, className = "" }) {
  return <div className={`mono text-xs text-text-muted mb-3 uppercase tracking-wide ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-medium mb-1">{title}</h1>
        {subtitle && <p className="text-text-muted text-sm">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-surface-raised rounded-sm ${className}`} />;
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="py-8 px-4 text-center">
      <p className="text-sm">{title}</p>
      {hint && <p className="mono text-xs text-text-muted mt-1">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="py-6 px-4 text-center" role="alert">
      <p className="mono text-xs text-signal-danger mb-1">{error?.code || "ERROR"}</p>
      <p className="text-sm text-text-muted mb-3">{error?.message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className={btnCls}>
          Retry
        </button>
      )}
    </div>
  );
}

export function FullScreenLoader({ label = "RESTORING SESSION…" }) {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <span className="mono text-xs text-text-muted animate-pulse">{label}</span>
    </div>
  );
}

export function ClassBadge({ classification }) {
  const sif = classification === "SIF";
  return (
    <span className={`mono text-xs px-2 py-0.5 rounded-sm shrink-0 ${sif ? "bg-signal-danger/15 text-signal-danger" : "bg-signal-safe/15 text-signal-safe"}`}>
      {sif ? "SIF" : "CLEARED"}
    </span>
  );
}

const CHIP_TONES = {
  muted: "border-border text-text-muted",
  danger: "border-signal-danger/50 text-signal-danger",
  safe: "border-signal-safe/50 text-signal-safe",
};
export function Chip({ children, tone = "muted", title }) {
  return (
    <span title={title} className={`mono text-xs px-2 py-0.5 border rounded-sm ${CHIP_TONES[tone] || CHIP_TONES.muted}`}>
      {children}
    </span>
  );
}

export function Meter({ value, tone = "danger" }) {
  const w = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
  const color = tone === "danger" ? "bg-signal-danger/80" : tone === "safe" ? "bg-signal-safe" : "bg-text-muted/60";
  return (
    <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="mono text-[11px] text-text-muted uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
