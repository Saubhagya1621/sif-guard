import { motion } from "framer-motion";

// 3D flip cards — hover/tap reveals the mechanism behind each feature.
// Front face is the plain claim; back face is the specific, technical
// reason to believe it, styled as a mono data readout to match the rest
// of the instrument-panel language.

const CARDS = [
  {
    front: { tag: "EXPLAINABLE", title: "Never a black box" },
    back: {
      body: "Every classification highlights the exact phrases that drove the score.",
      readout: 'highlightedPhrases: [\n  "without isolating the inlet line"\n]',
      color: "var(--color-signal-safe)",
    },
  },
  {
    front: { tag: "SIF METHOD", title: "Potential, not outcome" },
    back: {
      body: "Scores what could have happened if the barrier had failed — not just what actually did.",
      readout: 'severityPotential: 0.87\nactualOutcome: "none"',
      color: "#F5C445",
    },
  },
  {
    front: { tag: "PATTERN MINING", title: "Catches the repeat" },
    back: {
      body: "Clusters recurring barrier-failure combinations across sites before they happen a third time.",
      readout: 'cluster: "Confined Space\n+ Missing Isolation" · 6×',
      color: "var(--color-signal-danger)",
    },
  },
  {
    front: { tag: "ACTIVE LEARNING", title: "Gets sharper weekly" },
    back: {
      body: "Reviewer overrides feed straight back into scheduled retraining.",
      readout: "reviewerOverride.reviewed: true\n→ retrain queue",
      color: "var(--color-signal-safe)",
    },
  },
  {
    front: { tag: "MULTILINGUAL", title: "Reads the field, not the lab" },
    back: {
      body: "Hindi, Assamese and English ingestion — built for OIL's actual Assam/NE operations.",
      readout: 'lang: "as" | "hi" | "en"\nocrFallback: true',
      color: "#F5C445",
    },
  },
  {
    front: { tag: "OFFLINE-FIRST", title: "Works where signal doesn't" },
    back: {
      body: "Field capture queues locally at remote sites and syncs once connectivity returns.",
      readout: "queued: 14 reports\nsync: pending",
      color: "var(--color-signal-danger)",
    },
  },
];

function Card({ card }) {
  return (
    <div className="group [perspective:1000px] h-48">
      <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* front */}
        <div className="absolute inset-0 panel p-5 flex flex-col justify-between [backface-visibility:hidden]">
          <span className="mono text-xs text-text-muted">{card.front.tag}</span>
          <h3 className="text-lg font-medium">{card.front.title}</h3>
          <span className="mono text-xs text-text-muted">hover to see how →</span>
        </div>
        {/* back */}
        <div
          className="absolute inset-0 panel p-5 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ borderColor: card.back.color }}
        >
          <p className="text-sm leading-snug">{card.back.body}</p>
          <pre className="mono text-xs whitespace-pre-wrap" style={{ color: card.back.color }}>
{card.back.readout}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function FlipCards() {
  return (
    <div id="how-it-works" className="px-6 md:px-10 py-16 md:py-24 max-w-6xl mx-auto border-t border-border">
      <div className="mb-10">
        <span className="mono text-xs text-signal-safe">HOW IT WORKS</span>
        <h2 className="text-2xl md:text-3xl font-medium mt-2">Six mechanisms, one pipeline.</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CARDS.map((card) => (
          <motion.div
            key={card.front.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.4 }}
          >
            <Card card={card} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
