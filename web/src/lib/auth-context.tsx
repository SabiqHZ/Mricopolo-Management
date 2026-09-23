"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { apiFetch } from "./api";

type User = { id: number; username: string; email: string };

type AuthContextType = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      return localStorage.getItem("titip_jual_token");
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const storedUser = localStorage.getItem("titip_jual_user");
      if (!storedUser) return null;
      return JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem("titip_jual_token");
      localStorage.removeItem("titip_jual_user");
      return null;
    }
  });

  const loading = false;

  const login = async (identifier: string, password: string) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });

    const nextToken = data.token;
    setToken(nextToken);
    setUser(data.user);
    localStorage.setItem("titip_jual_token", nextToken);
    localStorage.setItem("titip_jual_user", JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("titip_jual_token");
    localStorage.removeItem("titip_jual_user");
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
