// Live Node API (docs/API_CONTRACT.md §2). Every call sends the httpOnly session cookie.
import { downloadFile, request, uploadWithProgress } from "./client";

// auth
export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password }, skipAuthRedirect: true }).then((r) => r.user);
export const logout = () => request("/auth/logout", { method: "POST", skipAuthRedirect: true });
export const me = () => request("/auth/me", { skipAuthRedirect: true }).then((r) => r.user);
export const registerUser = (data) => request("/auth/register", { method: "POST", body: data }).then((r) => r.user);

// reports
export const getReports = (filters = {}) => request("/reports", { params: filters }); // { items, total, page, limit }
export const getReport = (id) => request(`/reports/${encodeURIComponent(id)}`); // { report, audit }
export const submitReview = (id, body) =>
  request(`/reports/${encodeURIComponent(id)}/review`, { method: "PATCH", body }).then((r) => r.report);
export const uploadReports = (file, onProgress) => uploadWithProgress("/reports/upload", file, onProgress);

// dashboard (all scoped by role on the server)
export const getSummary = (params) => request("/dashboard/summary", { params });
export const getSiteRankings = (params) => request("/dashboard/sites", { params }).then((r) => r.items);
export const getPatterns = (params) => request("/dashboard/patterns", { params }).then((r) => r.items);
export const getTrends = (params) => request("/dashboard/trends", { params }).then((r) => r.daily);
export const getRuleDistribution = (params) => request("/dashboard/rules", { params }).then((r) => r.items);

// export
export const exportReport = ({ format, from, to }) =>
  downloadFile("/export", { format, from, to }, `sif-guard-priority-list_${from}_${to}.${format}`);

// admin
export const getUsers = () => request("/admin/users").then((r) => r.items);
export const updateUser = (id, patch) => request(`/admin/users/${id}`, { method: "PATCH", body: patch }).then((r) => r.user);
export const getModel = () => request("/admin/model");
export const retrain = () => request("/admin/retrain", { method: "POST" });

// notifications
export const getNotifications = () => request("/notifications").then((r) => r.items);
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: "PATCH" });
