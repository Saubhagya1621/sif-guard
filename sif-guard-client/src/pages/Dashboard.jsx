import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { getSiteRankings, getPatterns, getTrends } from "../api/reportsApi";

function RiskBar({ site, index }) {
  const navigate = useNavigate();
  const pct = Math.round(site.sifPrecursorDensity * 100);
  const [displayPct, setDisplayPct] = useState(0);

  return (
    <motion.button
      onClick={() => navigate(`/dashboard/site/${site.id}`)}
      className="w-full text-left group"
      whileHover={{ x: 2 }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm">{site.name}</span>
        <span className="mono text-xs text-text-muted">
          {site.sifCount}/{site.totalReports} reports
        </span>
      </div>
      <div className="h-2 bg-surface-raised rounded-sm overflow-hidden flex items-center">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: index * 0.08, ease: "easeOut" }}
          onUpdate={(latest) => {
            const w = parseFloat(String(latest.width)) || 0;
            setDisplayPct(Math.round(w));
          }}
          className={`h-full ${pct >= 60 ? "bg-signal-danger" : pct >= 30 ? "bg-signal-danger/60" : "bg-signal-safe"}`}
        />
      </div>
      <div className="mono text-xs text-text-muted mt-1 group-hover:text-text-primary transition-colors">
        {displayPct}% precursor density
      </div>
    </motion.button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [sites, setSites] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSiteRankings(), getPatterns(), getTrends()]).then(([s, p, t]) => {
      setSites(user?.role === "site_supervisor" ? s.filter((x) => x.id === user.site) : s);
      setPatterns(p);
      setTrends(t);
      setLoading(false);
    });
  }, [user]);

  const maxTrend = Math.max(...trends.map((t) => t.total), 1);

  return (
    <Layout>
      <h1 className="text-xl font-medium mb-1">Site risk ranking</h1>
      <p className="text-text-muted text-sm mb-6">SIF-precursor density, current reporting period</p>

      {loading ? (
        <p className="mono text-xs text-text-muted">Loading site data…</p>
      ) : (
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-6">
          <div className="panel p-5 space-y-5">
            {sites.map((site, i) => (
              <RiskBar key={site.id} site={site} index={i} />
            ))}
          </div>

          <div className="space-y-6">
            <div className="panel p-5">
              <div className="mono text-xs text-text-muted mb-3">FLAGGED REPORTS OVER TIME</div>
              <div className="flex items-end gap-1.5 h-24">
                {trends.map((t) => (
                  <div key={t.date} className="flex-1 flex flex-col justify-end items-center gap-1">
                    <div
                      className="w-full bg-signal-danger/70 rounded-t-sm"
                      style={{ height: `${(t.sif / maxTrend) * 100}%`, minHeight: t.sif ? "3px" : "0" }}
                      title={`${t.sif} SIF-flagged on ${t.date}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mono text-xs text-text-muted mt-2">{trends[0]?.date} → {trends[trends.length - 1]?.date}</div>
            </div>

            <div className="panel p-5">
              <div className="mono text-xs text-text-muted mb-3">RECURRING PATTERNS</div>
              <div className="space-y-3">
                {patterns.length === 0 && (
                  <p className="text-sm text-text-muted">No recurring patterns yet.</p>
                )}
                {patterns.map((p, i) => (
                  <div key={i} className="text-sm border-l-2 border-signal-danger/60 pl-3">
                    {p.activity} + {p.barrierFailureType || "Unclassified"} —{" "}
                    <span className="mono text-signal-danger">{p.count} occurrences</span>{" "}
                    across {p.sites.length} site{p.sites.length > 1 ? "s" : ""} this month
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
