import { motion } from "framer-motion";

// A large sticky instrument dial — the persistent centerpiece that stays in
// view while the chapters scroll past beside it, the way anime.js keeps its
// ring on-screen through its whole scroll narrative. Built from OIL's own
// safety spectrum (green → amber → danger-orange) instead of a rainbow, and
// styled as a gauge/sensor face rather than a logo mark.

const SEGMENTS = 64;

const CHAPTERS = [
  { glyph: "radar", color: "var(--color-signal-safe)", label: "SCANNING" },
  { glyph: "shield", color: "#F5C445", label: "SCORING" },
  { glyph: "cluster", color: "var(--color-signal-danger)", label: "PATTERN" },
  { glyph: "pulse", color: "var(--color-signal-safe)", label: "ACTIVE" },
];

function GlyphRadar({ color }) {
  return (
    <motion.g initial={false} animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} style={{ originX: "0.5", originY: "0.5" }}>
      <line x1="100" y1="100" x2="100" y2="34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <path d="M100 100 L100 34 A66 66 0 0 1 145 55 Z" fill={color} opacity="0.12" />
    </motion.g>
  );
}

function GlyphShield({ color }) {
  return (
    <motion.path
      d="M100 50 L138 65 V102 C138 128 122 146 100 154 C78 146 62 128 62 102 V65 Z"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    />
  );
}

function GlyphCluster({ color }) {
  const nodes = [
    [100, 80], [78, 110], [122, 110], [100, 135], [70, 75], [130, 75],
  ];
  return (
    <g>
      {nodes.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="5"
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
        />
      ))}
      <motion.line x1="100" y1="80" x2="78" y2="110" stroke={color} strokeWidth="1" opacity="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
      <motion.line x1="100" y1="80" x2="122" y2="110" stroke={color} strokeWidth="1" opacity="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />
      <motion.line x1="78" y1="110" x2="100" y2="135" stroke={color} strokeWidth="1" opacity="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 }} />
      <motion.line x1="122" y1="110" x2="100" y2="135" stroke={color} strokeWidth="1" opacity="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 }} />
    </g>
  );
}

function GlyphPulse({ color }) {
  return (
    <motion.polyline
      points="55,100 75,100 85,72 98,128 108,88 118,100 145,100"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
    />
  );
}

const GLYPHS = { radar: GlyphRadar, shield: GlyphShield, cluster: GlyphCluster, pulse: GlyphPulse };

export default function InstrumentDial({ activeIndex = 0 }) {
  const chapter = CHAPTERS[activeIndex] ?? CHAPTERS[0];
  const Glyph = GLYPHS[chapter.glyph];
  const litSegments = Math.round(((activeIndex + 1) / CHAPTERS.length) * SEGMENTS);

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="aspect-square">
        <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* outer tick ring */}
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const a = (i / SEGMENTS) * Math.PI * 2 - Math.PI / 2;
          const lit = i < litSegments;
          const r1 = 92;
          const r2 = lit ? 98 : 96;
          return (
            <motion.line
              key={i}
              x1={100 + Math.cos(a) * r1}
              y1={100 + Math.sin(a) * r1}
              x2={100 + Math.cos(a) * r2}
              y2={100 + Math.sin(a) * r2}
              stroke={lit ? chapter.color : "var(--color-border)"}
              strokeWidth={lit ? 2 : 1}
              animate={{ opacity: lit ? 0.9 : 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.003 }}
            />
          );
        })}

        {/* inner rings */}
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--color-border)" strokeWidth="1" />
        <circle cx="100" cy="100" r="64" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1" />

        {/* slow-rotating dashed ring for ambient motion */}
        <motion.circle
          cx="100"
          cy="100"
          r="72"
          fill="none"
          stroke={chapter.color}
          strokeWidth="1"
          strokeDasharray="2 6"
          opacity="0.5"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ originX: "0.5", originY: "0.5" }}
        />

        <g key={chapter.glyph}>
          <Glyph color={chapter.color} />
        </g>
        </svg>
      </div>

      {/* Label sits in normal flow below the ring, not overlaid on top of
          it — an absolutely-positioned overlay was sitting underneath the
          tick marks and getting visually cut by them. */}
      <div className="text-center mt-3">
        <span className="mono text-xs tracking-wide" style={{ color: chapter.color }}>
          {chapter.label}
        </span>
      </div>
    </div>
  );
}
