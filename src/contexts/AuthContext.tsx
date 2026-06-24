"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import type { AuthUser } from "@/types";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    refreshUser();
  }, []);

  async function refreshUser() {
    try {
      const { data } = await axios.get("/api/auth/me");
      setUser(data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, senha: string) {
    const { data } = await axios.post("/api/auth/login", { email, senha });
    setUser(data.data);
    router.push("/");
  }

  async function logout() {
    await axios.post("/api/auth/logout");
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
