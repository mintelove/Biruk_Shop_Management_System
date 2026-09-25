import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always start from Login page by clearing/ignoring existing session tokens on app startup
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setUser(null);
    setLoading(false);
  }, []);

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data.user);
    return res.data.user;
  };

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const updateProfile = async (payload) => {
    const res = await api.patch("/auth/me", payload);
    if (res.data?.token) {
      localStorage.setItem("token", res.data.token);
    }
    if (res.data?.user) {
      setUser((prev) => ({ ...prev, ...res.data.user }));
    }
    return res.data;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      updateProfile
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
