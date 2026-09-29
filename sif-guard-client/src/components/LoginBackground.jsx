import "./LoginBackground.css";

// Pure CSS/SVG ambient backdrop for the Login page — no image or video
// asset, nothing that can fail to load or freeze on a static frame. Three
// layers, all driven by CSS @keyframes (not JS/rAF), so they're cheap and
// guaranteed to run: a fixed blueprint grid, a drifting scan-line, and a
// faint radar-ping pulse centered behind the form.
export default function LoginBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="login-bg-grid absolute inset-0" />
      <div className="login-bg-radar absolute inset-0 flex items-center justify-center">
        <div className="login-bg-radar-ring" />
      </div>
      <div className="login-bg-scanline absolute left-0 right-0 h-[2px]" />
    </div>
  );
}
