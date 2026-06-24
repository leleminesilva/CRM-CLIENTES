"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RegisterPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", role: "COMERCIAL" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.senha) return;
    setLoading(true);
    try {
      await axios.post("/api/auth/register", form);
      toast.success("Usuário criado com sucesso!");
      router.push("/login");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-950 dark:to-indigo-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Criar Conta</h1>
            <p className="text-muted-foreground text-sm mt-1">Cadastre um novo usuário no CRM</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@empresa.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={form.senha}
                  onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Perfil de Acesso</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                  <SelectItem value="GESTOR">Gestor</SelectItem>
                  <SelectItem value="COMERCIAL">Comercial</SelectItem>
                  <SelectItem value="OPERACIONAL">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? "Criando..." : "Criar Conta"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-indigo-600 hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
