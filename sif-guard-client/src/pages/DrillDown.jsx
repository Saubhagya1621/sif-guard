import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { SITES } from "../data/fixtures";
import { getReports } from "../api/reportsApi";

export default function DrillDown() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const site = SITES.find((s) => s.id === siteId);

  useEffect(() => {
    getReports({ site: siteId }).then(setReports);
  }, [siteId]);

  const barrierCounts = reports
    .filter((r) => r.barrierFailureType)
    .reduce((acc, r) => {
      acc[r.barrierFailureType] = (acc[r.barrierFailureType] || 0) + 1;
      return acc;
    }, {});
  const maxBarrier = Math.max(...Object.values(barrierCounts), 1);

  return (
    <Layout>
      <button onClick={() => navigate("/dashboard")} className="mono text-xs text-text-muted hover:text-text-primary mb-4">
        ‹ All sites
      </button>
      <h1 className="text-xl font-medium mb-1">{site?.name ?? siteId}</h1>
      <p className="text-text-muted text-sm mb-6">{site?.region} · {reports.length} reports on file</p>

      <div className="grid md:grid-cols-[1fr_1fr] gap-6 mb-6">
        <div className="panel p-5">
          <div className="mono text-xs text-text-muted mb-3">BARRIER FAILURE BREAKDOWN</div>
          <div className="space-y-2">
            {Object.entries(barrierCounts).map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{type}</span>
                  <span className="mono text-xs text-text-muted">{count}</span>
                </div>
                <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden">
                  <div className="h-full bg-signal-danger/70" style={{ width: `${(count / maxBarrier) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(barrierCounts).length === 0 && (
              <p className="text-sm text-text-muted">No barrier failures logged for this site.</p>
            )}
          </div>
        </div>
        <div className="panel p-5">
          <div className="mono text-xs text-text-muted mb-3">QUICK STATS</div>
          <div className="mono text-2xl text-signal-danger">{reports.filter((r) => r.isSifPotential).length}</div>
          <div className="text-sm text-text-muted mb-3">SIF-potential reports</div>
          <div className="mono text-2xl">{reports.length}</div>
          <div className="text-sm text-text-muted">Total reports logged</div>
        </div>
      </div>

      <button
        onClick={() => navigate(`/reports?site=${siteId}`)}
        className="mono text-xs px-3 py-1.5 border border-border rounded-sm hover:border-signal-safe transition-colors"
      >
        View all reports for this site
      </button>
    </Layout>
  );
}
