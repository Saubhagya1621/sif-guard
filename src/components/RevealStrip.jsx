import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

const STATS = [
  { value: "0.91", label: "peak SIF risk score, live demo" },
  { value: "3.2×", label: "triage speed vs quarterly manual review" },
  { value: "9", label: "IOGP Life-Saving Rules auto-tagged" },
  { value: "24/7", label: "offline-capable field ingestion" },
];

const FEATURES = [
  { title: "Explainable, not a black box", body: "Every classification highlights the exact phrases that drove the score — HSE officers can see the reasoning, not just trust it." },
  { title: "Potential severity, not just outcome", body: "Scores what could have happened if barriers had failed — the core SIF distinction most naive tools miss entirely." },
  { title: "Pattern mining across sites", body: "Surfaces recurring barrier-failure combinations before they repeat, instead of logging each incident in isolation." },
];

// Re-triggers an anime.js stagger every time the strip scrolls into view —
// this is the "replay on visit" motion the hero also does, applied to a
// second, independent section so the page keeps demonstrating motion as
// you scroll rather than front-loading it all into the hero.
export default function RevealStrip() {
  const statRef = useRef(null);
  const featureRef = useRef(null);

  useEffect(() => {
    const targets = [
      { el: statRef.current, selector: "[data-stat]", opts: { translateY: [24, 0], opacity: [0, 1], delay: stagger(90) } },
      { el: featureRef.current, selector: "[data-feature]", opts: { translateY: [30, 0], opacity: [0, 1], delay: stagger(120) } },
    ];

    const observers = targets.map(({ el, selector, opts }) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animate(el.querySelectorAll(selector), {
                ...opts,
                duration: 600,
                ease: "outQuad",
              });
            }
          });
        },
        { threshold: 0.3 }
      );
      obs.observe(el);
      return obs;
    });

    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <div className="px-6 md:px-10 py-14 md:py-20 max-w-6xl">
      <div ref={statRef} className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 border-t border-b border-border py-8">
        {STATS.map((s) => (
          <div key={s.label} data-stat style={{ opacity: 0 }}>
            <div className="mono text-2xl md:text-3xl text-signal-safe mb-1">{s.value}</div>
            <div className="text-xs text-text-muted leading-snug">{s.label}</div>
          </div>
        ))}
      </div>

      <div ref={featureRef} className="grid md:grid-cols-3 gap-px bg-border">
        {FEATURES.map((f) => (
          <div key={f.title} data-feature style={{ opacity: 0 }} className="bg-bg-base p-6">
            <h3 className="text-sm font-medium mb-2">{f.title}</h3>
            <p className="text-sm text-text-muted leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
