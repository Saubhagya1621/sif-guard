import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FullScreenLoader } from "./ui";

// UX gate only: the real enforcement is requireRole + site scoping in the Express API.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const denied = Boolean(user && roles && !roles.includes(user.role));

  useEffect(() => {
    if (denied) toast.error("Your role doesn't have access to that page.");
  }, [denied, toast]);

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (denied) return <Navigate to="/dashboard" replace />;
  return children;
}
