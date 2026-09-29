import { useState } from "react";
import Layout from "../components/Layout";

export default function Export() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [generated, setGenerated] = useState(false);

  function handleGenerate(e) {
    e.preventDefault();
    // Real endpoint: GET /api/export/report — returns a PDF/Excel stream.
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  }

  return (
    <Layout>
      <h1 className="text-xl font-medium mb-1">Intervention-priority export</h1>
      <p className="text-text-muted text-sm mb-6">Generate the weekly SIF-priority report as PDF or Excel.</p>

      <form onSubmit={handleGenerate} className="panel p-5 max-w-md space-y-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-sm px-3 py-2 text-sm outline-none focus:border-signal-safe"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-sm px-3 py-2 text-sm outline-none focus:border-signal-safe"
          />
        </div>
        <button
          type="submit"
          className="mono text-xs px-3 py-1.5 bg-signal-safe text-bg-base rounded-sm hover:opacity-90 transition-opacity"
        >
          Generate report
        </button>
        {generated && <p className="mono text-xs text-signal-safe">Report generated — download will start shortly.</p>}
      </form>
    </Layout>
  );
}
