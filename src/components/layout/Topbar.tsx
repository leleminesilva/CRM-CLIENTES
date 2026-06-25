"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Sun, Moon, Search, LogOut, User, Settings, ChevronDown, Menu, CalendarCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
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
import { ROLE_LABELS } from "@/lib/utils/formatters";
import { useSidebar } from "@/contexts/SidebarContext";

const TIPO_COLORS: Record<string, string> = {
  LIGACAO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  EMAIL: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  REUNIAO: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  VISITA: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PROPOSTA: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  FOLLOW_UP: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  OUTRO: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const TIPO_LABELS: Record<string, string> = {
  LIGACAO: "Ligação",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  VISITA: "Visita",
  PROPOSTA: "Proposta",
  FOLLOW_UP: "Follow-up",
  OUTRO: "Outro",
};

interface Tarefa {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade: string;
  dataVencimento: string;
  cliente?: { id: string; nome: string } | null;
  lead?: { id: string; titulo: string } | null;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { openMobile } = useSidebar();

  // Today's tasks
  const today = new Date().toISOString().split("T")[0];
  const { data: tarefasHoje } = useQuery<Tarefa[]>({
    queryKey: ["tarefas-hoje", today],
    queryFn: async () => {
      const { data } = await axios.get(`/api/tarefas?de=${today}&ate=${today}`);
      return data.data as Tarefa[];
    },
    staleTime: 60_000,
  });

  const tarefasPendentes = (tarefasHoje ?? []).filter(
    (t) => t.status !== "CONCLUIDA" && t.status !== "CANCELADA"
  );
  const tarefasConcluidas = (tarefasHoje ?? []).filter((t) => t.status === "CONCLUIDA");

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
      <Button
        variant="ghost"
        size="icon"
        onClick={openMobile}
        className="lg:hidden text-muted-foreground"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Page Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base md:text-lg font-semibold truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(!searchOpen)}
          className="text-muted-foreground"
        >
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
          {mounted ? (
            theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>

        {/* Notifications — today's tasks */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="w-5 h-5" />
              {tarefasPendentes.length > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {tarefasPendentes.length > 9 ? "9+" : tarefasPendentes.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold">Agenda de Hoje</span>
              </div>
              {tarefasHoje && tarefasHoje.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {tarefasConcluidas.length}/{tarefasHoje.length} concluídas
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-0" />

            {!tarefasHoje || tarefasHoje.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma tarefa para hoje</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[360px]">
                {tarefasPendentes.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Pendentes
                    </p>
                    <div className="space-y-1">
                      {tarefasPendentes.map((tarefa) => (
                        <button
                          key={tarefa.id}
                          onClick={() => router.push("/agenda")}
                          className="w-full text-left rounded-md px-2.5 py-2 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                TIPO_COLORS[tarefa.tipo] ?? TIPO_COLORS.OUTRO
                              }`}
                            >
                              {TIPO_LABELS[tarefa.tipo] ?? tarefa.tipo}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">
                                {tarefa.titulo}
                              </p>
                              {(tarefa.cliente || tarefa.lead) && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {tarefa.cliente?.nome ?? tarefa.lead?.titulo}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tarefasConcluidas.length > 0 && (
                  <div className="px-3 py-2 border-t">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Concluídas
                    </p>
                    <div className="space-y-1">
                      {tarefasConcluidas.map((tarefa) => (
                        <button
                          key={tarefa.id}
                          onClick={() => router.push("/agenda")}
                          className="w-full text-left rounded-md px-2.5 py-2 hover:bg-muted transition-colors opacity-60"
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                              ✓ {TIPO_LABELS[tarefa.tipo] ?? tarefa.tipo}
                            </span>
                            <p className="text-sm line-through truncate">{tarefa.titulo}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            )}

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
                <AvatarFallback className="bg-indigo-600 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[user?.role || ""] || user?.role}
                </p>
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
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
