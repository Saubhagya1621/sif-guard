import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import { USE_MOCK } from "../api/client";
import { ROLE_LABELS, SITE_NAME } from "../lib/constants";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/reports", label: "Reports" },
  { to: "/upload", label: "Upload", roles: ["admin", "hse_officer"] },
  { to: "/export", label: "Export", roles: ["admin", "hse_officer"] },
  { to: "/admin", label: "Admin", roles: ["admin"] },
];

const linkCls = ({ isActive }) =>
  `text-left px-2 py-1.5 text-sm rounded-sm whitespace-nowrap transition-colors ${
    isActive ? "bg-surface text-text-primary border-l-2 border-signal-safe" : "text-text-muted hover:text-text-primary"
  }`;

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user?.role));

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center md:items-stretch md:flex-col justify-between gap-4">
        <div className="flex items-center gap-4 md:block min-w-0">
          <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-3 md:mb-8 shrink-0">
            <div className="flex items-center gap-2">
              <span className="mono text-sm text-signal-safe">SIF-GUARD</span>
              {USE_MOCK && (
                <span className="mono text-[10px] px-1.5 py-0.5 border border-border rounded-sm text-text-muted" title="Built-in demo data (VITE_USE_MOCK)">
                  DEMO
                </span>
              )}
            </div>
            <NotificationBell />
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1" aria-label="Main">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkCls}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="shrink-0 flex items-center gap-3 md:block">
          <div className="mono text-xs text-text-muted md:mb-2 hidden sm:block">
            <div className="text-text-primary truncate">{user?.name}</div>
            <div>
              {ROLE_LABELS[user?.role]}
              {user?.siteId ? ` · ${SITE_NAME[user.siteId]}` : ""}
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-text-muted hover:text-signal-danger transition-colors">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 overflow-x-hidden">{children}</main>
    </div>
  );
}
