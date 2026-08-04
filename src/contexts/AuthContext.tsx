"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
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
  const sessaoExpiradaTratada = useRef(false);

  useEffect(() => {
    refreshUser();
  }, []);

  // Sessão expirada/token inválido acontece a qualquer momento (ex: token
  // vencido em uso prolongado) e antes disso ficava só um "Erro ao
  // atualizar X" genérico do formulário, sem indicar que era preciso logar
  // de novo. Intercepta globalmente e manda pro login com uma mensagem clara.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const url: string = error?.config?.url || "";
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          !url.startsWith("/api/auth/") &&
          !sessaoExpiradaTratada.current
        ) {
          sessaoExpiradaTratada.current = true;
          setUser(null);
          toast.error("Sessão expirada. Faça login novamente.");
          router.push("/login");
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [router]);

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
    sessaoExpiradaTratada.current = false;
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
