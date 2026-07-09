"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Sun, Moon, Search, LogOut, User, Settings, ChevronDown, Menu, CalendarCheck, AlertCircle, UserPlus, Timer, TrendingDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROLE_LABELS, hojeISO } from "@/lib/utils/formatters";
import { useSidebar } from "@/contexts/SidebarContext";

const TIPO_TASK_COLORS: Record<string, string> = {
  LIGACAO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  EMAIL: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  REUNIAO: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  VISITA: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PROPOSTA: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  FOLLOW_UP: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  OUTRO: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const TIPO_TASK_LABELS: Record<string, string> = {
  LIGACAO: "Ligação",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  VISITA: "Visita",
  PROPOSTA: "Proposta",
  FOLLOW_UP: "Follow-up",
  OUTRO: "Outro",
};

const NOTIF_ICONS: Record<string, React.ElementType> = {
  LEAD_NOVO: UserPlus,
  TAREFA_VENCENDO: Timer,
  OPORTUNIDADE_PARADA: TrendingDown,
  CLIENTE_SEM_CONTATO: AlertCircle,
  SISTEMA: Bell,
};

const NOTIF_COLORS: Record<string, string> = {
  LEAD_NOVO: "text-blue-500",
  TAREFA_VENCENDO: "text-amber-500",
  OPORTUNIDADE_PARADA: "text-orange-500",
  CLIENTE_SEM_CONTATO: "text-red-500",
  SISTEMA: "text-indigo-500",
};

interface Tarefa {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade: string;
  dataVencimento: string;
  horario?: string | null;
  cliente?: { id: string; nome: string } | null;
  lead?: { id: string; titulo: string } | null;
}

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  linkUrl?: string | null;
  createdAt: string;
}

const BREADCRUMBS: Record<string, string> = {
  "/": "Dashboard",
  "/clientes": "Clientes",
  "/leads": "Leads / Kanban",
  "/oportunidades": "Oportunidades",
  "/empresas": "Empresas",
  "/contatos": "Contatos",
  "/tarefas": "Tarefas",
  "/agenda": "Agenda",
  "/relatorios": "Relatórios",
  "/usuarios": "Usuários",
  "/configuracoes": "Configurações",
  "/auditoria": "Auditoria",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { openMobile } = useSidebar();

  // Generate notifications (call on mount and every 5 min)
  const gerarMutation = useMutation({
    mutationFn: () => axios.post("/api/notificacoes/gerar"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const gerarNotificacoes = useCallback(() => { gerarMutation.mutate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    gerarNotificacoes();
    const interval = setInterval(gerarNotificacoes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [gerarNotificacoes]);

  // DB notifications
  const { data: notifData } = useQuery<{ data: Notificacao[]; naoLidas: number }>({
    queryKey: ["notificacoes"],
    queryFn: async () => {
      const { data } = await axios.get("/api/notificacoes");
      return data;
    },
    staleTime: 30_000,
  });

  const notificacoes = notifData?.data ?? [];
  const naoLidas = notifData?.naoLidas ?? 0;
  const notifNaoLidas = notificacoes.filter(n => !n.lida).slice(0, 15);

  // Today's tasks
  const today = hojeISO();
  const { data: tarefasHoje } = useQuery<Tarefa[]>({
    queryKey: ["tarefas-hoje", today],
    queryFn: async () => {
      const { data } = await axios.get(`/api/tarefas?de=${today}&ate=${today}`);
      return data.data as Tarefa[];
    },
    staleTime: 60_000,
  });

  const tarefasPendentes = (tarefasHoje ?? []).filter(t => t.status !== "CONCLUIDA" && t.status !== "CANCELADA");
  const tarefasConcluidas = (tarefasHoje ?? []).filter(t => t.status === "CONCLUIDA");

  async function marcarTodasLidas() {
    await axios.patch("/api/notificacoes");
    qc.invalidateQueries({ queryKey: ["notificacoes"] });
  }

  const totalBadge = naoLidas + tarefasPendentes.length;

  const pageTitle =
    Object.entries(BREADCRUMBS).find(
      ([path]) => pathname.startsWith(path) && (path === "/" ? pathname === "/" : true)
    )?.[1] || "CRM Clientes";

  const initials = user?.nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur-sm flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
      {/* Hamburger — mobile only */}
      <Button variant="ghost" size="icon" onClick={openMobile} className="lg:hidden text-muted-foreground">
        <Menu className="w-5 h-5" />
      </Button>

      {/* Page Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base md:text-lg font-semibold truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)} className="text-muted-foreground">
          <Search className="w-5 h-5" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-muted-foreground"
          suppressHydrationWarning
        >
          {mounted ? (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />) : <Moon className="w-5 h-5" />}
        </Button>

        {/* Notifications bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="w-5 h-5" />
              {totalBadge > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {totalBadge > 9 ? "9+" : totalBadge}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="px-4 py-3 flex items-center justify-between">
              <span className="font-semibold">Notificações</span>
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-0" />

            <ScrollArea className="max-h-[420px]">
              {/* System notifications (unread) */}
              {notifNaoLidas.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Alertas</p>
                  <div className="space-y-1">
                    {notifNaoLidas.map((n) => {
                      const Icon = NOTIF_ICONS[n.tipo] ?? Bell;
                      return (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (n.linkUrl) router.push(n.linkUrl);
                          }}
                          className="w-full text-left rounded-md px-2.5 py-2 hover:bg-muted transition-colors bg-indigo-50/50 dark:bg-indigo-950/20"
                        >
                          <div className="flex items-start gap-2.5">
                            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${NOTIF_COLORS[n.tipo] ?? "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">{n.titulo}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                            </div>
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Today's tasks */}
              {tarefasHoje && tarefasHoje.length > 0 && (
                <div className={`px-3 py-2 ${notifNaoLidas.length > 0 ? "border-t" : ""}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <CalendarCheck className="w-3 h-3" /> Agenda de Hoje
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {tarefasConcluidas.length}/{tarefasHoje.length} concluídas
                    </span>
                  </div>
                  <div className="space-y-1">
                    {tarefasPendentes.map((tarefa) => (
                      <button
                        key={tarefa.id}
                        onClick={() => router.push("/agenda")}
                        className="w-full text-left rounded-md px-2.5 py-2 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${TIPO_TASK_COLORS[tarefa.tipo] ?? TIPO_TASK_COLORS.OUTRO}`}>
                            {TIPO_TASK_LABELS[tarefa.tipo] ?? tarefa.tipo}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate leading-tight">{tarefa.titulo}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {tarefa.horario && <span className="font-medium">{tarefa.horario} · </span>}
                              {tarefa.cliente?.nome ?? tarefa.lead?.titulo}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {tarefasConcluidas.map((tarefa) => (
                      <button
                        key={tarefa.id}
                        onClick={() => router.push("/agenda")}
                        className="w-full text-left rounded-md px-2.5 py-2 hover:bg-muted transition-colors opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            ✓
                          </span>
                          <p className="text-sm line-through truncate">{tarefa.titulo}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {notifNaoLidas.length === 0 && (!tarefasHoje || tarefasHoje.length === 0) && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma notificação</p>
                </div>
              )}
            </ScrollArea>

            <DropdownMenuSeparator className="my-0" />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => router.push("/agenda")}
              >
                Ver agenda completa
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatar || undefined} />
                <AvatarFallback className="bg-indigo-600 text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.nome}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role || ""] || user?.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.nome}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
