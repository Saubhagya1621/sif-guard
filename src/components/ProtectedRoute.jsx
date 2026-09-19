import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Frontend-side gate only hides UI/redirects for UX — per the build spec,
// role enforcement for real data must happen in Express middleware
// (`requireRole([...])`) on every route, not here.
export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
