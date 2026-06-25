"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Bell, User, Building2, Lock, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/utils/formatters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

interface Prefs {
  leadNovo: boolean;
  tarefaVencendo: boolean;
  oportunidadeParada: boolean;
  clienteSemContato: boolean;
}

const NOTIF_OPTIONS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "leadNovo", label: "Novo lead atribuído", desc: "Quando um lead é atribuído a você" },
  { key: "tarefaVencendo", label: "Tarefa vencendo", desc: "1 dia antes do vencimento" },
  { key: "oportunidadeParada", label: "Oportunidade parada", desc: "Sem movimentação por 7 dias" },
  { key: "clienteSemContato", label: "Cliente sem contato", desc: "Há mais de 30 dias sem contato" },
];

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  const mudarSenhaMutation = useMutation({
    mutationFn: () => axios.post("/api/usuarios/mudar-senha", { senhaAtual, novaSenha }),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? "Erro ao alterar senha"
        : "Erro ao alterar senha";
      toast.error(msg);
    },
  });

  // Notification prefs
  const { data: prefs } = useQuery<Prefs>({
    queryKey: ["prefs-notificacoes"],
    queryFn: async () => {
      const { data } = await axios.get("/api/configuracoes/notificacoes");
      return data.data as Prefs;
    },
  });

  const prefsMutation = useMutation({
    mutationFn: (newPrefs: Prefs) => axios.put("/api/configuracoes/notificacoes", newPrefs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prefs-notificacoes"] });
      toast.success("Preferências salvas");
    },
    onError: () => toast.error("Erro ao salvar preferências"),
  });

  function togglePref(key: keyof Prefs, value: boolean) {
    const updated: Prefs = {
      leadNovo: true,
      tarefaVencendo: true,
      oportunidadeParada: true,
      clienteSemContato: true,
      ...(prefs ?? {}),
      [key]: value,
    };
    prefsMutation.mutate(updated);
  }

  function handleMudarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 6) return toast.error("A nova senha deve ter pelo menos 6 caracteres");
    if (novaSenha !== confirmarSenha) return toast.error("As senhas não coincidem");
    mudarSenhaMutation.mutate();
  }

  const themes = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground">Gerencie suas preferências</p>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Meu Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.nome?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg">{user?.nome}</p>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="text-sm text-indigo-600 font-medium">{ROLE_LABELS[user?.role || ""]}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMudarSenha} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <div className="relative">
                <Input
                  type={mostrarSenhas ? "text" : "password"}
                  placeholder="Digite sua senha atual"
                  value={senhaAtual}
                  onChange={e => setSenhaAtual(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhas(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {mostrarSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type={mostrarSenhas ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type={mostrarSenhas ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={!senhaAtual || !novaSenha || !confirmarSenha || mudarSenhaMutation.isPending}
            >
              {mudarSenhaMutation.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="mb-3 block">Tema</Label>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIF_OPTIONS.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs ? prefs[item.key] : true}
                onCheckedChange={(v) => togglePref(item.key, v)}
                disabled={prefsMutation.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Sobre o Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Versão</span>
            <span className="font-medium text-foreground">1.0.0</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Stack</span>
            <span className="font-medium text-foreground">Next.js 14 + Prisma + Supabase</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Ambiente</span>
            <span className="font-medium text-foreground">{process.env.NODE_ENV}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
