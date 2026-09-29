import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import TrendChart from "../components/TrendChart";
import PatternList from "../components/PatternList";
import { useAuth } from "../context/AuthContext";
import { getPatterns, getRuleDistribution, getSiteRankings, getSummary, getTrends } from "../api/reportsApi";
import { SITES, barrierLabel, ruleLabel } from "../lib/constants";
import { fmtDateTime } from "../lib/format";
import { EmptyState, ErrorState, Field, Label, PageHeader, Skeleton, SkeletonRows, btnCls, inputCls } from "../components/ui";

function RiskBar({ site, index }) {
  const navigate = useNavigate();
  const pct = Math.round(site.sifDensity * 100);
  const [displayPct, setDisplayPct] = useState(0);

  return (
    <motion.button onClick={() => navigate(`/dashboard/site/${site.siteId}`)} className="w-full text-left group" whileHover={{ x: 2 }}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-sm">
          <span className="mono text-xs text-text-muted mr-2">#{site.rank}</span>
          {site.siteName}
        </span>
        <span className="mono text-xs text-text-muted shrink-0">
          {site.sifCount}/{site.totalReports} SIF
        </span>
      </div>
      <div className="h-2 bg-surface-raised rounded-sm overflow-hidden flex items-center">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: index * 0.08, ease: "easeOut" }}
          onUpdate={(latest) => setDisplayPct(Math.round(parseFloat(String(latest.width)) || 0))}
          className={`h-full ${pct >= 60 ? "bg-signal-danger" : pct >= 30 ? "bg-signal-danger/60" : "bg-signal-safe"}`}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 mono text-xs text-text-muted mt-1 group-hover:text-text-primary transition-colors">
        <span>{displayPct}% precursor density</span>
        {site.topRule && (
          <span>
            {ruleLabel(site.topRule)}
            {site.topBarrier ? ` · ${barrierLabel(site.topBarrier)}` : ""}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function Stat({ label, value, sub, tone, small, loading }) {
  const color = tone === "danger" ? "text-signal-danger" : tone === "safe" ? "text-signal-safe" : "";
  return (
    <div className="panel p-4">
      <div className="mono text-[11px] text-text-muted uppercase tracking-wide mb-2">{label}</div>
      {loading ? (
        <Skeleton className="h-6 w-16" />
      ) : (
        <div className={`mono ${small ? "text-sm" : "text-2xl"} ${color}`}>{value ?? "—"}</div>
      )}
      {sub && !loading && <div className="mono text-[11px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function Section({ label, state, children, onRetry }) {
  return (
    <div className="panel p-5">
      <Label>{label}</Label>
      {!state ? <SkeletonRows rows={4} /> : state.error ? <ErrorState error={state.error} onRetry={onRetry} /> : children(state.value)}
    </div>
  );
}

const EMPTY_FILTERS = { siteId: "", from: "", to: "" };

export default function Dashboard() {
  const { user } = useAuth();
  const isSupervisor = user.role === "site_supervisor";
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setData(null);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const calls = {
      summary: getSummary(params),
      sites: getSiteRankings(params),
      trends: getTrends(params),
      patterns: getPatterns(params),
      rules: getRuleDistribution(params),
    };
    const keys = Object.keys(calls);
    const results = await Promise.allSettled(Object.values(calls));
    setData(Object.fromEntries(keys.map((k, i) => [k, results[i].status === "fulfilled" ? { value: results[i].value } : { error: results[i].reason }])));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const active = Object.values(filters).some(Boolean);
  const s = data?.summary?.value;

  return (
    <Layout>
      <PageHeader
        title="Site risk ranking"
        subtitle={isSupervisor ? "SIF-precursor density for your site" : "SIF-precursor density across OIL sites"}
      />

      <div className="flex flex-wrap items-end gap-3 mb-6">
        {!isSupervisor && (
          <Field label="Site">
            <select value={filters.siteId} onChange={set("siteId")} className={inputCls}>
              <option value="">All sites</option>
              {SITES.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="From">
          <input type="date" value={filters.from} onChange={set("from")} className={inputCls} />
        </Field>
        <Field label="To">
          <input type="date" value={filters.to} onChange={set("to")} className={inputCls} />
        </Field>
        {active && (
          <button onClick={() => setFilters(EMPTY_FILTERS)} className={btnCls}>
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Reports" value={s?.totalReports} loading={!data} />
        <Stat label="SIF-potential" value={s?.sifCount} sub={s ? `${s.sifPercent}% of reports` : ""} tone="danger" loading={!data} />
        <Stat label="Reviewed" value={s?.reviewedCount} tone="safe" loading={!data} />
        <Stat label="Last updated" value={s?.lastUpdated ? fmtDateTime(s.lastUpdated) : "—"} small loading={!data} />
      </div>

      <div className="grid md:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6">
          <Section label="Sites by SIF-precursor density" state={data?.sites} onRetry={load}>
            {(sites) =>
              sites.length ? (
                <div className="space-y-5">
                  {sites.map((site, i) => (
                    <RiskBar key={site.siteId} site={site} index={i} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No site data yet." />
              )
            }
          </Section>

          <Section label="Life-saving rule distribution" state={data?.rules} onRetry={load}>
            {(rules) => {
              const max = Math.max(...rules.map((r) => r.count), 1);
              return rules.some((r) => r.count) ? (
                <div className="space-y-2">
                  {rules.map((r) => (
                    <div key={r.rule}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{ruleLabel(r.rule)}</span>
                        <span className="mono text-xs text-text-muted">{r.count}</span>
                      </div>
                      <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden">
                        <div className="h-full bg-signal-danger/70" style={{ width: `${(r.count / max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No rule tags in this period." />
              );
            }}
          </Section>
        </div>

        <div className="space-y-6">
          <Section label="Flagged reports over time" state={data?.trends} onRetry={load}>
            {(daily) => <TrendChart daily={daily} />}
          </Section>

          <Section label="Recurring precursor patterns" state={data?.patterns} onRetry={load}>
            {(items) => <PatternList items={items} />}
          </Section>
        </div>
      </div>
    </Layout>
  );
}
