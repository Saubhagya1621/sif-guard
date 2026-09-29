import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import DrillDown from "./pages/DrillDown";
import Upload from "./pages/Upload";
import Export from "./pages/Export";
import Admin from "./pages/Admin";

const REVIEWERS = ["hse_officer", "admin"];

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/site/:siteId" element={<ProtectedRoute><DrillDown /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute roles={REVIEWERS}><Upload /></ProtectedRoute>} />
            <Route path="/export" element={<ProtectedRoute roles={REVIEWERS}><Export /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><Admin /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
