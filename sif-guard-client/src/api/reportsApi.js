// Single entry point for all data access. Pages import from here; the VITE_USE_MOCK flag decides
// whether calls go to the in-memory demo (mockApi) or the live Node API (realApi). Same shapes either way.
import { USE_MOCK } from "./client";
import * as mock from "./mockApi";
import * as real from "./realApi";

const api = USE_MOCK ? mock : real;

export const login = (...a) => api.login(...a);
export const logout = (...a) => api.logout(...a);
export const me = (...a) => api.me(...a);
export const registerUser = (...a) => api.registerUser(...a);

export const getReports = (...a) => api.getReports(...a);
export const getReport = (...a) => api.getReport(...a);
export const submitReview = (...a) => api.submitReview(...a);
export const uploadReports = (...a) => api.uploadReports(...a);

export const getSummary = (...a) => api.getSummary(...a);
export const getSiteRankings = (...a) => api.getSiteRankings(...a);
export const getPatterns = (...a) => api.getPatterns(...a);
export const getTrends = (...a) => api.getTrends(...a);
export const getRuleDistribution = (...a) => api.getRuleDistribution(...a);

export const exportReport = (...a) => api.exportReport(...a);

export const getUsers = (...a) => api.getUsers(...a);
export const updateUser = (...a) => api.updateUser(...a);
export const getModel = (...a) => api.getModel(...a);
export const retrain = (...a) => api.retrain(...a);

export const getNotifications = (...a) => api.getNotifications(...a);
export const markNotificationRead = (...a) => api.markNotificationRead(...a);
