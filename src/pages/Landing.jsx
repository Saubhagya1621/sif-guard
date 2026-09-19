import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import InstrumentDial from "../components/InstrumentDial";
import BlueprintDiagram from "../components/BlueprintDiagram";
import VideoHero from "../components/VideoHero";
import FlipCards from "../components/FlipCards";

const CHAPTERS = [
  {
    tag: "01 · INGEST",
    color: "var(--color-signal-safe)",
    title: "It reads every report, not a monthly sample.",
    body: "Free-text UA/UC observations, near-miss logs and incident write-ups flow in continuously — bulk CSV upload or live sync from the HSSE platform. Nothing waits for quarterly review.",
    readout: `POST /api/reports/upload\n{ "site": "duliajan", "batch": 247 }`,
  },
  {
    tag: "02 · SCORE",
    color: "#F5C445",
    title: "Scored for what could have happened, not what did.",
    body: "The severity-potential scorer asks what would have happened if the barrier had actually failed — the core SIF distinction most tools collapse into ordinary outcome severity.",
    readout: `{ "isSifPotential": true,\n  "confidence": 0.91,\n  "rule": "Line of Fire" }`,
  },
  {
    tag: "03 · PATTERN",
    color: "var(--color-signal-danger)",
    title: "Finds the barrier that keeps failing, across sites.",
    body: "HDBSCAN clustering on report embeddings surfaces recurring activity/location/barrier-failure combinations before they repeat a third or fourth time.",
    readout: `"Confined Space + Missing Isolation"\n— 6 occurrences · 3 sites this month`,
  },
  {
    tag: "04 · ACT",
    color: "var(--color-signal-safe)",
    title: "Reviewer corrections make it sharper every week.",
    body: "Every HSE override feeds the active-learning loop. The model that flags next week's reports is a little better than the one that flagged this week's.",
    readout: `PATCH /api/reports/:id/review\n{ "correctedClassification": false }`,
  },
];

function Chapter({ chapter, index, onEnter }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onEnter(index);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onEnter]);

  return (
    <div ref={ref} className="py-20 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.5 }}
        transition={{ duration: 0.5 }}
      >
        <span className="mono text-xs tracking-wide" style={{ color: chapter.color }}>
          {chapter.tag}
        </span>
        <h2 className="text-2xl md:text-3xl font-medium leading-tight mt-3 mb-4 max-w-md">
          {chapter.title}
        </h2>
        <p className="text-text-muted max-w-md leading-relaxed mb-5">{chapter.body}</p>
        <pre className="mono text-xs text-text-muted border border-border rounded-sm p-3 max-w-sm whitespace-pre-wrap">
{chapter.readout}
        </pre>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [activeChapter, setActiveChapter] = useState(0);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <VideoHero />

      <FlipCards />

      {/* Scroll-driven chapters with sticky instrument dial.
          NOTE: no `overflow-hidden` on this subtree or any ancestor — that
          silently breaks `position: sticky` and was why the dial vanished. */}
      <div className="relative border-t border-border px-6 md:px-10 max-w-6xl mx-auto grid md:grid-cols-[1.1fr_0.9fr] gap-10">
        <div>
          {CHAPTERS.map((chapter, i) => (
            <Chapter key={chapter.tag} chapter={chapter} index={i} onEnter={setActiveChapter} />
          ))}
        </div>
        <div className="hidden md:block sticky top-24 self-start">
          <InstrumentDial activeIndex={activeChapter} />
        </div>
        <div className="md:hidden flex justify-center py-8">
          <InstrumentDial activeIndex={activeChapter} />
        </div>
      </div>

      <BlueprintDiagram />

      <div className="text-center py-16 border-t border-border px-6">
        <h2 className="text-2xl md:text-3xl font-medium mb-6">Ready to see it on your own reports?</h2>
        <button
          onClick={() => navigate("/login")}
          className="mono text-xs px-4 py-2 bg-signal-safe text-bg-base rounded-sm hover:opacity-90 transition-opacity"
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}
