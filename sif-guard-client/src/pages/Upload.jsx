import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [fileName, setFileName] = useState("");
  const navigate = useNavigate();

  function simulateUpload(name) {
    setFileName(name);
    setProgress(0);
    const total = 500;
    let parsed = 0;
    const interval = setInterval(() => {
      parsed += Math.floor(Math.random() * 40) + 20;
      if (parsed >= total) {
        parsed = total;
        clearInterval(interval);
        setTimeout(() => navigate("/reports"), 500);
      }
      setProgress(parsed);
    }, 120);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    simulateUpload(file?.name ?? "field-reports.csv");
  }

  return (
    <Layout>
      <h1 className="text-xl font-medium mb-1">Upload reports</h1>
      <p className="text-text-muted text-sm mb-6">Bulk CSV/Excel import — triggers classification on ingest.</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`panel p-10 text-center transition-colors ${dragging ? "border-signal-safe" : ""}`}
      >
        {progress === null ? (
          <>
            <p className="text-sm mb-4">Drag a CSV or Excel file here</p>
            <label className="mono text-xs px-3 py-1.5 border border-border rounded-sm hover:border-signal-safe transition-colors cursor-pointer inline-block">
              or browse files
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && simulateUpload(e.target.files[0].name)}
              />
            </label>
          </>
        ) : (
          <div>
            <div className="mono text-sm text-signal-safe mb-3">{fileName}</div>
            <div className="mono text-lg mb-3">
              {progress} / 500 parsed
            </div>
            <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden max-w-xs mx-auto">
              <div
                className="h-full bg-signal-safe transition-all duration-150"
                style={{ width: `${(progress / 500) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
