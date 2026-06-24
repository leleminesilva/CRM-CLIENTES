"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  async function onSubmit() {
    await new Promise((r) => setTimeout(r, 1000));
    setSent(true);
    toast.success("E-mail de recuperação enviado!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="fp-inner" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c8e8f8" />
                <stop offset="100%" stopColor="#5aace0" />
              </linearGradient>
            </defs>
            <rect x="19" y="19" width="62" height="62" rx="13" transform="rotate(45 50 50)" fill="rgba(42,68,105,0.60)" />
            <rect x="27" y="27" width="46" height="46" rx="10" transform="rotate(45 50 50)" fill="rgba(72,108,155,0.72)" />
            <rect x="36" y="36" width="28" height="28" rx="6" transform="rotate(45 50 50)" fill="url(#fp-inner)" />
          </svg>
          <span className="text-xl font-black tracking-wide">
            INFINITY<span className="text-blue-500 ml-1">GLASS</span>
          </span>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">E-mail enviado!</h2>
            <p className="text-muted-foreground">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para o login
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Recuperar senha</h2>
              <p className="text-muted-foreground mt-1">
                Informe seu e-mail para receber as instruções de recuperação
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-destructive text-sm">{String(errors.email.message)}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando..." : "Enviar instruções"}
              </Button>
            </form>

            <Link
              href="/login"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
