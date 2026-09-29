import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import TrendChart from "../components/TrendChart";
import PatternList from "../components/PatternList";
import { useAuth } from "../context/AuthContext";
import { getPatterns, getReports, getSiteRankings, getTrends } from "../api/reportsApi";
import { SITES, SITE_NAME, barrierLabel, ruleLabel } from "../lib/constants";
import { fmtDate, pct } from "../lib/format";
import { ClassBadge, EmptyState, ErrorState, Label, SkeletonRows, btnCls } from "../components/ui";

export default function DrillDown() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const forbidden = user.role === "site_supervisor" && siteId !== user.siteId;
  const known = Boolean(SITE_NAME[siteId]);

  const load = useCallback(async () => {
    if (forbidden || !known) return;
    setData(null);
    const res = await Promise.allSettled([
      getSiteRankings({ siteId }),
      getReports({ siteId, limit: 100 }),
      getPatterns({ siteId }),
      getTrends({ siteId }),
    ]);
    const pick = (i) => (res[i].status === "fulfilled" ? { value: res[i].value } : { error: res[i].reason });
    setData({ site: pick(0), reports: pick(1), patterns: pick(2), trends: pick(3) });
  }, [siteId, forbidden, known]);

  useEffect(() => {
    load();
  }, [load]);

  if (forbidden) return <Navigate to={`/dashboard/site/${user.siteId}`} replace />;
  if (!known) return <Navigate to="/dashboard" replace />;

  const meta = SITES.find((s) => s.id === siteId);
  const site = data?.site?.value?.[0];
  const reports = data?.reports?.value?.items || [];
  const sif = reports.filter((r) => r.classification === "SIF");
  const barrierCounts = sif
    .filter((r) => r.barrierFailureType && r.barrierFailureType !== "none")
    .reduce((acc, r) => ({ ...acc, [r.barrierFailureType]: (acc[r.barrierFailureType] || 0) + 1 }), {});
  const maxBarrier = Math.max(...Object.values(barrierCounts), 1);

  return (
    <Layout>
      {user.role !== "site_supervisor" && (
        <button onClick={() => navigate("/dashboard")} className="mono text-xs text-text-muted hover:text-text-primary mb-4">
          ‹ All sites
        </button>
      )}
      <h1 className="text-xl font-medium mb-1">{meta.name}</h1>
      <p className="text-text-muted text-sm mb-6">
        {meta.region} · {data?.reports?.value ? `${data.reports.value.total} reports on file` : "loading…"}
      </p>

      {data?.reports?.error && <ErrorState error={data.reports.error} onRetry={load} />}

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="panel p-5">
          <Label>Quick stats</Label>
          {!data ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mono text-2xl text-signal-danger">{site?.sifCount ?? sif.length}</div>
                <div className="text-sm text-text-muted">SIF-potential reports</div>
              </div>
              <div>
                <div className="mono text-2xl">{pct(site?.sifDensity || 0)}</div>
                <div className="text-sm text-text-muted">Precursor density{site?.rank ? ` · rank #${site.rank}` : ""}</div>
              </div>
              {site?.topRule && (
                <div className="mono text-xs text-text-muted">
                  Top rule: {ruleLabel(site.topRule)}
                  {site.topBarrier ? ` · ${barrierLabel(site.topBarrier)}` : ""}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <Label>Barrier failures (SIF reports)</Label>
          {!data ? (
            <SkeletonRows rows={4} />
          ) : Object.keys(barrierCounts).length === 0 ? (
            <p className="text-sm text-text-muted">No barrier failures logged for this site.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(barrierCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{barrierLabel(type)}</span>
                      <span className="mono text-xs text-text-muted">{count}</span>
                    </div>
                    <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden">
                      <div className="h-full bg-signal-danger/70" style={{ width: `${(count / maxBarrier) * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <Label>Flagged over time</Label>
          {!data ? <SkeletonRows rows={4} /> : data.trends.error ? <ErrorState error={data.trends.error} /> : <TrendChart daily={data.trends.value} />}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="panel p-5">
          <Label>Recurring patterns at this site</Label>
          {!data ? <SkeletonRows rows={3} /> : data.patterns.error ? <ErrorState error={data.patterns.error} onRetry={load} /> : <PatternList items={data.patterns.value} />}
        </div>
        <div className="panel p-5">
          <Label>Highest-risk reports</Label>
          {!data ? (
            <SkeletonRows rows={4} />
          ) : sif.length === 0 ? (
            <EmptyState title="No SIF-potential reports." />
          ) : (
            <div className="space-y-2">
              {[...sif]
                .sort((a, b) => b.sifProbability - a.sifProbability)
                .slice(0, 5)
                .map((r) => (
                  <Link
                    key={r.id}
                    to={`/reports?siteId=${siteId}&q=${r.id}&open=${r.id}`}
                    className="flex items-center gap-3 text-sm hover:bg-surface-raised/60 px-1 py-1 rounded-sm transition-colors"
                  >
                    <ClassBadge classification={r.classification} />
                    <span className="flex-1 truncate">{r.text}</span>
                    <span className="mono text-xs text-signal-danger shrink-0">{pct(r.sifProbability)}</span>
                    <span className="mono text-xs text-text-muted shrink-0 hidden sm:inline">{fmtDate(r.reportedAt)}</span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => navigate(`/reports?siteId=${siteId}`)} className={btnCls}>
        View all reports for this site
      </button>
    </Layout>
  );
}
