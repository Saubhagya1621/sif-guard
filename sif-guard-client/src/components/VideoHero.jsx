import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { animate, stagger } from "animejs";

// Full-bleed autoplay video hero — the plant footage runs the instant the
// page opens, muted/looped/inline so it starts without a click on every
// browser. A dark gradient scrim keeps the overlaid headline readable
// against a moving, high-contrast background instead of a flat color.
export default function VideoHero() {
  const navigate = useNavigate();
  const headlineRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Autoplay can still be blocked on some mobile browsers even when
    // muted+playsInline are set as attributes; force it in JS as a fallback.
    videoRef.current?.play().catch(() => {});

    if (!headlineRef.current) return;
    const words = headlineRef.current.querySelectorAll("[data-word]");
    animate(words, {
      translateY: [30, 0],
      opacity: [0, 1],
      delay: stagger(50, { start: 300 }),
      duration: 800,
      ease: "outExpo",
    });
  }, []);

  const headline = "The plant never stops talking. Most of it gets missed.";

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/videos/refinery-hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      {/* scrim — darkens footage so light text stays readable, heavier at
          the bottom so the scroll cue and CTA never sit on a bright patch */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-base/90 via-bg-base/55 to-bg-base" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-base/80 via-bg-base/20 to-transparent" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <span className="mono text-sm text-signal-safe">SIF-GUARD</span>
        <button
          onClick={() => navigate("/login")}
          className="mono text-xs px-3 py-1.5 border border-border/80 rounded-sm bg-bg-base/40 backdrop-blur-sm hover:border-signal-safe transition-colors"
        >
          Sign in
        </button>
      </header>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-10 max-w-2xl">
        <span className="mono text-xs text-signal-danger mb-4">LIVE FIELD FEED · DULIAJAN</span>
        <h1 ref={headlineRef} className="text-3xl md:text-5xl font-medium leading-tight mb-5">
          {headline.split(" ").map((word, i) => (
            <span key={i} data-word className="inline-block mr-[0.28em]" style={{ opacity: 0 }}>
              {word}
            </span>
          ))}
        </h1>
        <p className="text-text-muted max-w-md leading-relaxed mb-8">
          SIF-Guard reads every UA/UC and near-miss report as it's filed, scores the
          fatality potential a human reviewer would only catch on the third read, and
          flags it before the shift ends — not next quarter.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/login")}
            className="mono text-xs px-4 py-2 bg-signal-safe text-bg-base rounded-sm hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Open dashboard
          </button>
          <a
            href="#how-it-works"
            className="mono text-xs px-4 py-2 border border-border rounded-sm hover:border-signal-safe transition-colors"
          >
            See how it works
          </a>
        </div>
      </div>

      <motion.div
        className="relative z-10 flex justify-center pb-8"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="mono text-xs text-text-muted">scroll ↓</span>
      </motion.div>
    </div>
  );
}
