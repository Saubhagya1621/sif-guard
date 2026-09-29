import { useEffect, useRef } from "react";

// Full-bleed animated canvas background for the landing page — a sweeping
// radar arc over a faint grid, with drifting "report" points that flare
// orange when the sweep crosses them. Continuous, ambient motion (not a
// one-shot), so the page never feels static the way a plain gradient does.
export default function RadarField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    let angle = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const points = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.8,
      flareUntil: 0,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w * 0.72;
      const cy = h * 0.45;
      const radius = Math.max(w, h) * 0.65;

      ctx.clearRect(0, 0, w, h);

      // faint grid
      ctx.strokeStyle = "rgba(139,148,140,0.08)";
      ctx.lineWidth = 1;
      const step = 42;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // concentric radar rings
      ctx.strokeStyle = "rgba(62,213,152,0.10)";
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (radius / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // sweep gradient wedge
      const grad = ctx.createConicGradient
        ? ctx.createConicGradient(angle, cx, cy)
        : null;
      if (grad) {
        grad.addColorStop(0, "rgba(62,213,152,0.22)");
        grad.addColorStop(0.06, "rgba(62,213,152,0)");
        grad.addColorStop(1, "rgba(62,213,152,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // sweep line
      ctx.strokeStyle = "rgba(62,213,152,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();

      // points, flaring when the sweep passes near them
      const now = performance.now();
      points.forEach((p) => {
        const px = p.x * w;
        const py = p.y * h;
        const pointAngle = Math.atan2(py - cy, px - cx);
        let diff = Math.abs(((angle - pointAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
        if (diff < 0.05) p.flareUntil = now + 900;

        const flaring = now < p.flareUntil;
        ctx.beginPath();
        ctx.arc(px, py, flaring ? p.r * 2.4 : p.r, 0, Math.PI * 2);
        ctx.fillStyle = flaring ? "rgba(255,106,26,0.9)" : "rgba(236,239,234,0.35)";
        ctx.fill();
        if (flaring) {
          ctx.beginPath();
          ctx.arc(px, py, p.r * 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,106,26,0.12)";
          ctx.fill();
        }
      });

      if (!reduceMotion) angle += 0.006;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}
