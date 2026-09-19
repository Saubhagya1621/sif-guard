import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import LoginBackground from "../components/LoginBackground";

const ROLES = [
  { value: "hse_officer", label: "HSE Officer" },
  { value: "site_supervisor", label: "Site Supervisor" },
  { value: "admin", label: "Admin" },
];

// Any password containing "fail" demo-triggers the denied state, so a
// reviewer can see both outcomes without needing a real backend.
function willFail(password) {
  return /fail/i.test(password);
}

// Types a string out character-by-character (not a fade) inside a <span>,
// finishing instantly if the user prefers reduced motion.
function TypedLine({ text, color, speed = 18, onDone }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? text : "");

  useEffect(() => {
    if (reduceMotion) {
      onDone?.();
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduceMotion]);

  return (
    <span className="mono text-xs tracking-wide" style={{ color }}>
      {shown}
      {shown.length < text.length && !reduceMotion && (
        <span className="inline-block w-1.5 h-3 bg-current align-middle ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("hse_officer");
  const [status, setStatus] = useState("idle"); // idle | verifying | granted | denied
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  function handleSubmit(e) {
    e.preventDefault();
    if (status === "verifying") return;
    setStatus("verifying");
  }

  function handleVerifyDone() {
    if (willFail(password)) {
      setStatus("denied");
    } else {
      setStatus("granted-line2");
    }
  }

  function handleGrantedDone() {
    setStatus("granted");
    const delay = reduceMotion ? 200 : 500;
    setTimeout(() => {
      login(role);
      navigate(role === "site_supervisor" ? "/dashboard?site=duliajan" : "/dashboard");
    }, delay);
  }

  function retry() {
    setStatus("idle");
  }

  const roleLabel = ROLES.find((r) => r.value === role)?.label.toUpperCase().replace(" ", "_") ?? "";

  return (
    <div className="min-h-screen w-full relative bg-bg-base text-text-primary">
      <LoginBackground />

      {/* Single centered instrument panel — no split, no image panel. */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px] panel px-8 py-9">
          <div
            className="mono text-sm mb-6 tracking-wide"
            style={{ color: "var(--color-text-primary)" }}
          >
            SIF-GUARD
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mono text-xs tracking-wide text-text-muted mb-2 uppercase">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status !== "idle"}
                autoComplete="username"
                className="w-full bg-transparent border-0 border-b rounded-none px-0 py-2 text-sm outline-none transition-colors"
                style={{ borderBottomColor: "var(--color-border)", borderBottomWidth: "1px" }}
                onFocus={(e) => (e.target.style.borderBottomColor = "var(--color-text-primary)")}
                onBlur={(e) => (e.target.style.borderBottomColor = "var(--color-border)")}
              />
            </div>

            <div className="mb-4">
              <label className="block mono text-xs tracking-wide text-text-muted mb-2 uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status !== "idle"}
                  autoComplete="current-password"
                  className="w-full bg-transparent border-0 border-b rounded-none px-0 py-2 pr-8 text-sm outline-none transition-colors"
                  style={{ borderBottomColor: "var(--color-border)", borderBottomWidth: "1px" }}
                  onFocus={(e) => (e.target.style.borderBottomColor = "var(--color-text-primary)")}
                  onBlur={(e) => (e.target.style.borderBottomColor = "var(--color-border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  className="absolute right-0 top-1/2 -translate-y-1/2 mono text-xs text-text-muted hover:text-text-primary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "hide" : "show"}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block mono text-xs tracking-wide text-text-muted mb-2 uppercase">
                Role (demo only)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={status !== "idle"}
                className="w-full bg-transparent border-0 border-b rounded-none px-0 py-2 text-sm outline-none transition-colors appearance-none cursor-pointer"
                style={{ borderBottomColor: "var(--color-border)", borderBottomWidth: "1px" }}
                onFocus={(e) => (e.target.style.borderBottomColor = "var(--color-text-primary)")}
                onBlur={(e) => (e.target.style.borderBottomColor = "var(--color-border)")}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value} className="bg-surface">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-10 flex items-center">
              <AnimatePresence mode="wait">
                {status === "idle" && (
                  <motion.button
                    key="submit"
                    type="submit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mono text-xs tracking-wide px-4 py-2 border hover:bg-text-primary hover:text-bg-base transition-colors"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    [&nbsp;AUTHENTICATE&nbsp;]
                  </motion.button>
                )}

                {status === "verifying" && (
                  <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <TypedLine
                      text="VERIFYING CREDENTIALS..."
                      color="var(--color-text-muted)"
                      onDone={handleVerifyDone}
                    />
                  </motion.div>
                )}

                {status === "granted-line2" && (
                  <motion.div key="granted-line2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <TypedLine
                      text={`ACCESS GRANTED — ${roleLabel}`}
                      color="var(--color-signal-safe)"
                      onDone={handleGrantedDone}
                    />
                  </motion.div>
                )}

                {status === "granted" && (
                  <motion.div key="granted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span className="mono text-xs tracking-wide" style={{ color: "var(--color-signal-safe)" }}>
                      ACCESS GRANTED — {roleLabel}
                    </span>
                  </motion.div>
                )}

                {status === "denied" && (
                  <motion.button
                    key="denied"
                    type="button"
                    onClick={retry}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mono text-xs tracking-wide text-left"
                  >
                    <TypedLine
                      text="ACCESS DENIED — INVALID CREDENTIALS"
                      color="var(--color-signal-danger)"
                    />
                    <span className="block text-text-muted mt-1 text-[11px]">tap to retry</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </form>

          <p className="mono text-[11px] text-text-muted mt-6 leading-relaxed">
            Accounts are provisioned by an admin. No self-signup on this terminal.
          </p>
        </div>
      </div>
    </div>
  );
}
