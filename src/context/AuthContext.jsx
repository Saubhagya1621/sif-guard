import { createContext, useContext, useState } from "react";
import { CURRENT_USER } from "../data/fixtures";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Mirrors the JWT/httpOnly-cookie session the real Express API will set;
  // `user` is null until /api/auth/login resolves.
  const [user, setUser] = useState(null);

  function login(role) {
    setUser({ ...CURRENT_USER, role, site: role === "site_supervisor" ? "duliajan" : null });
  }

  function logout() {
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
