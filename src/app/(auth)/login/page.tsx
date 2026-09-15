"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Building2, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { loginSchema, type LoginInput } from "@/lib/validators/usuario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Sistema = "crm" | "financeiro";

const SISTEMAS: { id: Sistema; label: string; icon: typeof Building2; destino: string; accent: string; glow: string }[] = [
  { id: "crm", label: "CRM", icon: Building2, destino: "/", accent: "linear-gradient(135deg, #2563eb, #3b82f6)", glow: "rgba(59,130,246,0.35)" },
  { id: "financeiro", label: "Financeiro", icon: Wallet, destino: "/financeiro", accent: "linear-gradient(135deg, #059669, #10b981)", glow: "rgba(16,185,129,0.35)" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sistema, setSistema] = useState<Sistema>("crm");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const atual = SISTEMAS.find((s) => s.id === sistema)!;

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    try {
      const { redirecionadoPara } = await login(data.email, data.senha, atual.destino);
      if (atual.destino === "/financeiro" && redirecionadoPara !== "/financeiro") {
        toast.error("Você não tem acesso ao Financeiro. Peça a um administrador para liberar em Usuários.");
      } else {
        toast.success("Login realizado com sucesso!");
      }
    } catch {
      toast.error("E-mail ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 60% 40%, #0d2a6b 0%, #061022 60%, #030d1a 100%)",
      }}
    >
      {/* Decorative wireframe diamond pattern — background */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.045]">
        {/* Bottom-left cluster */}
        {[-120,-80,-40,0,40].map((offset, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: 220, height: 220,
              border: "1.5px solid #93c5fd",
              borderRadius: 28,
              transform: `rotate(45deg) translate(${offset}px, 0px)`,
              bottom: -60,
              left: -60,
            }}
          />
        ))}
        {/* Top-right cluster */}
        {[-40,0,40,80,120].map((offset, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: 200, height: 200,
              border: "1.5px solid #93c5fd",
              borderRadius: 24,
              transform: `rotate(45deg) translate(${offset}px, 0px)`,
              top: -50,
              right: -80,
            }}
          />
        ))}
        {/* Center glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-100"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,1), transparent)" }}
        />
      </div>

      {/* Login Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-3xl p-8 sm:p-10 shadow-2xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-5">
            <Logo height={90} />
          </div>

          {/* Brand name */}
          <div className="mb-1">
            <span className="text-2xl font-black tracking-widest text-white">INFINITY</span>
            <span className="text-2xl font-black tracking-widest text-blue-400 ml-1">GLASS</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="h-px w-8 bg-blue-400/50" />
            <span className="text-xs font-semibold tracking-[0.3em] text-blue-200/70 uppercase">Vidraçaria</span>
            <div className="h-px w-8 bg-blue-400/50" />
          </div>

          <h2 className="text-xl font-semibold text-white/90">Bem-vindo de volta</h2>
          <p className="text-sm text-white/40 mt-1">
            Entre com suas credenciais para acessar {sistema === "crm" ? "o CRM" : "o Financeiro"}
          </p>
        </div>

        {/* Seletor de sistema */}
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-6"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {SISTEMAS.map((s) => {
            const ativo = s.id === sistema;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSistema(s.id)}
                className="flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all duration-200"
                style={
                  ativo
                    ? { background: s.accent, color: "#fff", boxShadow: `0 4px 14px ${s.glow}` }
                    : { color: "rgba(255,255,255,0.45)" }
                }
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/70 text-sm font-medium">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              {...register("email")}
              className="h-11 rounded-xl text-white placeholder:text-white/25"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: errors.email ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)",
              }}
            />
            {errors.email && (
              <p className="text-red-400 text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha" className="text-white/70 text-sm font-medium">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="senha"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("senha")}
                className="h-11 rounded-xl pr-10 text-white placeholder:text-white/25"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: errors.senha ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.senha && (
              <p className="text-red-400 text-xs">{errors.senha.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <a
              href="/forgot-password"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              Esqueceu a senha?
            </a>
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200"
            disabled={loading}
            style={{
              background: atual.accent,
              boxShadow: `0 4px 20px ${atual.glow}`,
            }}
          >
            {loading ? "Entrando..." : `Entrar no ${atual.label}`}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-8">
          © {new Date().getFullYear()} Infinity Glass Vidraçaria. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
