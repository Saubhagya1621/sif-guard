import { useState } from "react";
import Layout from "../components/Layout";
import { CURRENT_USER } from "../data/fixtures";

const USERS = [
  { name: "K. Baruah", role: "hse_officer", site: "—" },
  { name: "A. Sharma", role: "hse_officer", site: "—" },
  { name: "R. Gogoi", role: "site_supervisor", site: "Duliajan Field" },
  { name: "V. Singh", role: "site_supervisor", site: "Jaisalmer Block" },
];

export default function Admin() {
  const [retraining, setRetraining] = useState(false);
  const [lastRetrain, setLastRetrain] = useState(null);

  function handleRetrain() {
    // Real call: POST /ml-service/retrain (proxied through Express).
    setRetraining(true);
    setTimeout(() => {
      setRetraining(false);
      setLastRetrain(new Date().toISOString().slice(0, 16).replace("T", " "));
    }, 1800);
  }

  return (
    <Layout>
      <h1 className="text-xl font-medium mb-1">Admin</h1>
      <p className="text-text-muted text-sm mb-6">User management and model operations.</p>

      <div className="grid md:grid-cols-[1.3fr_1fr] gap-6">
        <div className="panel p-5 overflow-x-auto">
          <div className="mono text-xs text-text-muted mb-3">USERS</div>
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="text-text-muted text-left border-b border-border">
                <th className="pb-2 font-normal">Name</th>
                <th className="pb-2 font-normal">Role</th>
                <th className="pb-2 font-normal">Site</th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.name} className="border-b border-border last:border-0">
                  <td className="py-2">{u.name}</td>
                  <td className="py-2 mono text-xs text-text-muted">{u.role.replace("_", " ")}</td>
                  <td className="py-2 text-text-muted">{u.site}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <div className="mono text-xs text-text-muted mb-3">MODEL OPERATIONS</div>
          <div className="mono text-2xl mb-1">91.4%</div>
          <div className="text-sm text-text-muted mb-4">Accuracy on reviewer-corrected samples</div>
          <button
            onClick={handleRetrain}
            disabled={retraining}
            className="mono text-xs px-3 py-1.5 border border-border rounded-sm hover:border-signal-safe transition-colors disabled:opacity-50"
          >
            {retraining ? "Retraining…" : "Trigger retrain"}
          </button>
          {lastRetrain && (
            <p className="mono text-xs text-signal-safe mt-3">Last retrained {lastRetrain}</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
