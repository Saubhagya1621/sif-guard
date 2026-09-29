import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { useToast } from "../context/ToastContext";
import { uploadReports } from "../api/reportsApi";
import { saveBlob, USE_MOCK } from "../api/client";
import { ddmmyyyy } from "../lib/format";
import { ErrorState, Label, PageHeader, btnCls, btnPrimaryCls } from "../components/ui";

const MAX_BYTES = 10 * 1024 * 1024;
const COLUMNS = [
  ["text", "required", "Free-text observation / near-miss / incident narrative"],
  ["site", "required", "Site id or name, e.g. duliajan or Duliajan Field"],
  ["report_type", "required", "UA, UC, near_miss or incident"],
  ["reported_at", "required", "ISO (2026-08-14) or DD/MM/YYYY"],
  ["activity", "optional", "e.g. Pump maintenance"],
  ["location", "optional", "e.g. Well pad 3"],
  ["reported_by", "optional", "Reporter name"],
  ["report_id", "optional", "R-1234; generated if empty"],
];

function sampleCsv() {
  const d = ddmmyyyy();
  const rows = [
    ["report_id", "site", "report_type", "reported_at", "activity", "location", "reported_by", "text"],
    ["", "moran", "near_miss", d, "Pump maintenance", "Well pad 3", "K. Baruah", "Fitter opened the pump casing without lockout while the motor was still energised."],
    ["", "duliajan", "UA", d, "Crane lift", "Rig DJN-12", "R. Gogoi", "Rigger walked under the suspended load during crane lift of casing joints. No tagline used."],
    ["", "naharkatiya", "UA", d, "Hot work", "GGS-4", "M. Saikia", "Welding started near the crude oil tank without hot work permit and no gas test."],
    ["", "baghjan", "near_miss", d, "Confined space entry", "Tank farm", "J. Das", "Helper entered the sludge tank before atmospheric testing; standby man was not present at the manhole."],
    ["", "jaisalmer", "near_miss", d, "Vehicle movement", "Field road", "V. Singh", "Tanker driver was overspeeding on the field road and nearly hit a pedestrian."],
    ["", "Moran Field", "UC", d, "Housekeeping", "Workshop", "K. Baruah", "Housekeeping poor near the workshop entrance, oily rags lying on the floor."],
    ["", "duliajan", "incident", d, "General movement", "Control room", "B. Phukan", "Worker slipped on a wet floor in the control room, no injury."],
    ["", "duliajan", "near_miss", d, "Pump maintenance", "Well pad 2", "Field HSE", "पंप की मरम्मत के दौरान लॉकआउट नहीं किया गया था और मोटर चालू थी।"],
  ];
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return `\uFEFF${rows.map((r) => r.map(q).join(",")).join("\n")}\n`;
}

function validate(file) {
  if (!file) return "Choose a file first.";
  if (!/\.(csv|xlsx)$/i.test(file.name)) return "Only .csv and .xlsx files are supported.";
  if (file.size > MAX_BYTES) return `File is ${(file.size / 1048576).toFixed(1)} MB; the limit is 10 MB.`;
  if (file.size === 0) return "The file is empty.";
  return null;
}

export default function Upload() {
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState({ name: "idle" }); // idle | uploading | processing | done | error

  async function start(file) {
    const problem = validate(file);
    if (problem) {
      setPhase({ name: "error", error: { code: "VALIDATION_ERROR", message: problem } });
      return;
    }
    setFileName(file.name);
    setPhase({ name: "uploading", progress: 0 });
    try {
      const result = await uploadReports(file, (p) =>
        setPhase((ph) => (ph.name === "uploading" ? (p >= 1 ? { name: "processing" } : { name: "uploading", progress: p }) : ph)),
      );
      setPhase({ name: "done", result });
      if (result.inserted) toast.success(`${result.inserted} reports classified · ${result.sifCount} flagged SIF`);
    } catch (error) {
      setPhase({ name: "error", error });
    }
  }

  function reset() {
    setPhase({ name: "idle" });
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = phase.name === "uploading" || phase.name === "processing";
  const result = phase.result;
  const mlDown = result?.errors?.some((e) => /ML_UNAVAILABLE|ML service/i.test(e.message));

  return (
    <Layout>
      <PageHeader title="Upload reports" subtitle="Bulk CSV/Excel import: every row is classified, rule-tagged and stored on ingest." />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="space-y-6">
          {phase.name === "idle" || phase.name === "error" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                start(e.dataTransfer.files?.[0]);
              }}
              className={`panel p-10 text-center transition-colors ${dragging ? "border-signal-safe" : ""}`}
            >
              <p className="text-sm mb-4">Drag a CSV or Excel file here</p>
              <label className={`${btnCls} cursor-pointer inline-block`}>
                or browse files
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && start(e.target.files[0])}
                />
              </label>
              <p className="mono text-[11px] text-text-muted mt-4">.csv or .xlsx · max 10 MB{USE_MOCK ? " · demo mode reads .csv only" : ""}</p>
              {phase.name === "error" && (
                <div className="mt-6 border-t border-border pt-2">
                  <ErrorState error={phase.error} />
                </div>
              )}
            </div>
          ) : busy ? (
            <div className="panel p-10 text-center" aria-live="polite">
              <div className="mono text-sm text-signal-safe mb-3">{fileName}</div>
              {phase.name === "uploading" ? (
                <>
                  <div className="mono text-lg mb-3">Uploading {Math.round((phase.progress || 0) * 100)}%</div>
                  <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden max-w-xs mx-auto">
                    <div className="h-full bg-signal-safe transition-all duration-150" style={{ width: `${(phase.progress || 0) * 100}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="mono text-lg mb-3">Classifying reports…</div>
                  <div className="h-1.5 bg-surface-raised rounded-sm overflow-hidden max-w-xs mx-auto">
                    <div className="h-full w-1/3 bg-signal-safe animate-pulse" />
                  </div>
                  <p className="mono text-[11px] text-text-muted mt-3">Running the SIF classifier, rule tagger and explainability (batches of 32)</p>
                </>
              )}
            </div>
          ) : (
            <div className="panel p-6" aria-live="polite">
              <Label>Result · {fileName}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  ["Rows", result.total, ""],
                  ["Stored", result.inserted, "text-signal-safe"],
                  ["SIF-flagged", result.sifCount, "text-signal-danger"],
                  ["Skipped", result.skipped, result.skipped ? "text-signal-danger" : ""],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div className={`mono text-2xl ${color}`}>{value}</div>
                    <div className="mono text-[11px] text-text-muted uppercase">{label}</div>
                  </div>
                ))}
              </div>
              {mlDown && (
                <p className="mono text-xs text-signal-danger mb-4">
                  The ML service was unavailable, so some rows were skipped. Start it and upload the same file again; stored rows are de-duplicated.
                </p>
              )}
              {result.errors?.length > 0 && (
                <div className="mb-5">
                  <div className="mono text-[11px] text-text-muted uppercase mb-2">Row issues ({result.errors.length})</div>
                  <div className="max-h-64 overflow-y-auto border border-border rounded-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-muted text-left border-b border-border">
                          <th className="px-3 py-2 font-normal mono text-xs w-16">Row</th>
                          <th className="px-3 py-2 font-normal mono text-xs">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e) => (
                          <tr key={`${e.row}-${e.message}`} className="border-b border-border last:border-0">
                            <td className="px-3 py-1.5 mono text-xs text-text-muted">{e.row}</td>
                            <td className="px-3 py-1.5">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {result.inserted > 0 && (
                  <Link to={`/reports?batchId=${encodeURIComponent(result.batchId)}`} className={btnPrimaryCls}>
                    View this batch
                  </Link>
                )}
                <button onClick={reset} className={btnCls}>
                  Upload another file
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="panel p-5 h-fit">
          <Label>Expected columns</Label>
          <table className="w-full text-sm mb-4">
            <tbody>
              {COLUMNS.map(([name, req, hint]) => (
                <tr key={name} className="border-b border-border last:border-0 align-top">
                  <td className="py-1.5 pr-3 mono text-xs whitespace-nowrap">{name}</td>
                  <td className={`py-1.5 pr-3 mono text-[11px] ${req === "required" ? "text-signal-danger" : "text-text-muted"}`}>{req}</td>
                  <td className="py-1.5 text-xs text-text-muted">{hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-text-muted mb-3">Header names are case-insensitive. Duplicate rows (same site, text and date) are skipped.</p>
          <button onClick={() => saveBlob(new Blob([sampleCsv()], { type: "text/csv;charset=utf-8" }), "sif-guard-sample.csv")} className={btnCls}>
            Download sample CSV
          </button>
        </div>
      </div>
    </Layout>
  );
}
