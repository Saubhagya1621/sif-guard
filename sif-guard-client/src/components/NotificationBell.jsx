import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead } from "../api/reportsApi";
import { fmtDateTime } from "../lib/format";

// High-SIF-probability alerts (created server-side when sifProbability >= NOTIFY_THRESHOLD).
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    getNotifications().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  function openItem(n) {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    navigate(`/reports?q=${encodeURIComponent(n.reportId)}&open=${encodeURIComponent(n.reportId)}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!open) load();
          setOpen((o) => !o);
        }}
        aria-label={`Alerts, ${unread} unread`}
        aria-expanded={open}
        className="mono text-xs px-2 py-1 border border-border rounded-sm hover:border-signal-safe transition-colors"
      >
        ALERTS
        <span className={`ml-1.5 ${unread ? "text-signal-danger" : "text-text-muted"}`}>{unread}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-[85vw] panel z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="mono text-xs text-text-muted">HIGH-RISK ALERTS</span>
            <span className="mono text-xs text-text-muted">{unread} unread</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="mono text-xs text-text-muted p-4">No alerts.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-surface-raised transition-colors"
                >
                  <div className={`text-sm leading-snug ${n.read ? "text-text-muted" : ""}`}>
                    {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal-danger mr-2 align-middle" />}
                    {n.message}
                  </div>
                  <div className="mono text-[11px] text-text-muted mt-1">{fmtDateTime(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
