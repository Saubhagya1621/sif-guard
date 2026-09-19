import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/reports", label: "Reports" },
  { to: "/upload", label: "Upload" },
  { to: "/export", label: "Export" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border p-4 md:p-5 flex items-center md:items-stretch md:flex-col justify-between gap-4">
        <div className="flex items-center gap-6 md:block min-w-0">
          <div className="mono text-sm text-signal-safe md:mb-8 shrink-0">SIF-GUARD</div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-left px-2 py-1.5 text-sm rounded-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-surface text-text-primary border-l-2 border-signal-safe"
                      : "text-text-muted hover:text-text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `text-left px-2 py-1.5 text-sm rounded-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-surface text-text-primary border-l-2 border-signal-safe"
                      : "text-text-muted hover:text-text-primary"
                  }`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>
        <div className="shrink-0 md:mt-0 flex items-center md:block">
          <div className="mono text-xs text-text-muted mb-0 md:mb-2 hidden sm:block">
            {user?.name} · {user?.role.replace("_", " ")}
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="text-xs text-text-muted hover:text-signal-danger transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 overflow-x-hidden">{children}</main>
    </div>
  );
}
