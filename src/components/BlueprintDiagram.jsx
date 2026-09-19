import { motion } from "framer-motion";

// A blueprint-style exploded diagram of the classification pipeline — the
// line-art "toolbox" chapter equivalent, redrawn as an OIL-safety sensor
// stack instead of a camera lens: raw report → isolation check → scored
// output, laid out with leader-line labels like a technical spec sheet.
//
// viewBox is sized to fit the longest label text at this font size — SVG
// clips anything outside its viewBox when it scales up to fill a wide
// column, so the width here isn't cosmetic, it's the fix for that clipping.

const LABELS = [
  { y: 40, text: "raw-text-ingest" },
  { y: 90, text: "entity-extraction" },
  { y: 140, text: "life-saving-rule-tag" },
  { y: 190, text: "severity-potential-score" },
  { y: 240, text: "reviewer-feedback-loop" },
];

const DISC_CX = 140;
const LEADER_END_X = 270;
const LABEL_X = 276;
const VIEWBOX_WIDTH = 520;

export default function BlueprintDiagram() {
  return (
    <div className="relative py-16 md:py-24 border-t border-border">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 px-6 md:px-10 max-w-6xl mx-auto items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-medium mb-3">The complete triage pipeline</h2>
          <p className="text-text-muted max-w-md leading-relaxed">
            Every report moves through the same stack — normalized, tagged against
            the IOGP Life-Saving Rules, scored for potential rather than actual
            severity, and fed back by reviewer corrections. One API, five stages.
          </p>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${VIEWBOX_WIDTH} 280`} className="w-full h-auto">
            {/* exploded stack of discs, like a sensor assembly */}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.ellipse
                key={i}
                cx={DISC_CX - i * 8}
                cy={50 + i * 45}
                rx={70 - i * 4}
                ry={16}
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 0.7, x: 0 }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <motion.line
                key={`c${i}`}
                x1={DISC_CX - i * 8}
                y1={50 + i * 45}
                x2={DISC_CX - (i + 1) * 8}
                y2={50 + (i + 1) * 45}
                stroke="var(--color-border)"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{ duration: 0.4, delay: i * 0.1 + 0.2 }}
              />
            ))}
            {/* leader lines + labels — all text ends well inside VIEWBOX_WIDTH */}
            {LABELS.map((l, i) => (
              <g key={l.text}>
                <line x1={DISC_CX - i * 6} y1={l.y - 5} x2={LEADER_END_X} y2={l.y - 5} stroke="var(--color-border)" strokeWidth="1" />
                <text x={LABEL_X} y={l.y - 2} className="mono" fontSize="9" fill="var(--color-text-muted)">
                  {l.text}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
