"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loginSchema, type LoginInput } from "@/lib/validators/usuario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    try {
      await login(data.email, data.senha);
      toast.success("Login realizado com sucesso!");
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
          {/* Diamond logo — 3 concentric layered diamonds */}
          <div className="flex items-center justify-center mb-5">
            <svg width="96" height="96" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="innerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c8e8f8" />
                  <stop offset="100%" stopColor="#5aace0" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Outer diamond — dark slate blue */}
              <rect
                x="19" y="19" width="62" height="62" rx="13"
                transform="rotate(45 50 50)"
                fill="rgba(42, 68, 105, 0.60)"
              />
              {/* Middle diamond — medium slate blue */}
              <rect
                x="27" y="27" width="46" height="46" rx="10"
                transform="rotate(45 50 50)"
                fill="rgba(72, 108, 155, 0.72)"
              />
              {/* Inner diamond — bright blue gradient */}
              <rect
                x="36" y="36" width="28" height="28" rx="6"
                transform="rotate(45 50 50)"
                fill="url(#innerGrad)"
                filter="url(#glow)"
              />
            </svg>
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
          <p className="text-sm text-white/40 mt-1">Entre com suas credenciais para continuar</p>
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
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              boxShadow: "0 4px 20px rgba(59,130,246,0.35)",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
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
