"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Bell, User, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/utils/formatters";

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

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
          {[
            { label: "Novo lead atribuído", desc: "Quando um lead é atribuído a você" },
            { label: "Tarefa vencendo", desc: "1 dia antes do vencimento" },
            { label: "Oportunidade parada", desc: "Sem movimentação por 7 dias" },
            { label: "Cliente sem contato", desc: "Há mais de 30 dias sem contato" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch defaultChecked />
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
