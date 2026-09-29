import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";

// The one orchestrated motion moment in the whole app (see design spec
// Section 8). It dramatizes what SIF-Guard actually does: scan noisy field
// text and surface the one phrase that predicts a fatality-potential event.

const REPORT_TEXT =
  "Rigger positioned under a suspended load while adjusting a tag line during a crane lift. No barricade was in place to prevent standing beneath the load.";
const HAZARD_PHRASE = "positioned under a suspended load";
const HAZARD_START = REPORT_TEXT.indexOf(HAZARD_PHRASE);
const HAZARD_END = HAZARD_START + HAZARD_PHRASE.length;

export default function ScanHero() {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { amount: 0.6, once: false });
  const [runId, setRunId] = useState(0);
  const [typedLength, setTypedLength] = useState(reduceMotion ? REPORT_TEXT.length : 0);
  const [sweepDone, setSweepDone] = useState(reduceMotion);
  const [flagged, setFlagged] = useState(reduceMotion);

  // Re-run the scan sequence every time the panel scrolls back into view,
  // not just once on first mount — so revisiting the page (or scrolling
  // past and back) replays the demo instead of showing a frozen end state.
  useEffect(() => {
    if (inView && !reduceMotion) setRunId((n) => n + 1);
  }, [inView, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    setTypedLength(0);
    setSweepDone(false);
    setFlagged(false);
    let i = 0;
    const typeInterval = setInterval(() => {
      i += 3;
      setTypedLength(Math.min(i, REPORT_TEXT.length));
      if (i >= REPORT_TEXT.length) {
        clearInterval(typeInterval);
        setTimeout(() => setSweepDone(true), 250);
      }
    }, 12);
    return () => clearInterval(typeInterval);
  }, [reduceMotion, runId]);

  useEffect(() => {
    if (sweepDone) {
      const t = setTimeout(() => setFlagged(true), 550);
      return () => clearTimeout(t);
    }
  }, [sweepDone]);

  const visibleText = REPORT_TEXT.slice(0, typedLength);
  const before = visibleText.slice(0, Math.min(HAZARD_START, visibleText.length));
  const hazard = visibleText.slice(Math.min(HAZARD_START, visibleText.length), Math.min(HAZARD_END, visibleText.length));
  const after = visibleText.slice(Math.min(HAZARD_END, visibleText.length));

  return (
    <div ref={containerRef} className="panel relative overflow-hidden p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="mono text-xs text-text-muted">INCOMING REPORT · UA-2201</span>
        <button
          onClick={() => setRunId((n) => n + 1)}
          className="mono text-xs text-text-muted hover:text-signal-safe transition-colors"
        >
          ↻ replay
        </button>
      </div>

      <p className="mono text-sm md:text-base leading-relaxed text-text-primary min-h-[4.5em]">
        {before}
        <span
          className={`transition-colors duration-300 ${
            flagged ? "bg-signal-danger/20 text-signal-danger" : ""
          }`}
        >
          {hazard}
        </span>
        {after}
        {!sweepDone && !reduceMotion && <span className="inline-block w-2 h-4 bg-text-muted align-middle ml-0.5 animate-pulse" />}
      </p>

      {sweepDone && (
        <motion.div
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          style={{ transformOrigin: "left" }}
          className="h-px bg-text-muted/40 my-4"
        />
      )}

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={flagged ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.3 }}
        className="mono text-sm text-signal-danger"
      >
        {flagged ? "FLAGGED · LINE OF FIRE · RISK 0.91" : "\u00A0"}
      </motion.div>
    </div>
  );
}
