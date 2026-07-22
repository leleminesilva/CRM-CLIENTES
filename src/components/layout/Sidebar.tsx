"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users,
  CheckSquare, Calendar, BarChart3, UserCog, Search,
  Settings, ChevronLeft, ChevronRight, Shield, X, MessageCircle, MessageSquare, Bell,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useDevTheme } from "@/contexts/DevThemeContext";
import type { DevTheme } from "@/lib/devThemes";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { tocarNotificacaoNovoCliente } from "@/lib/utils/sound";

type Role = "ADMINISTRADOR" | "DESENVOLVEDOR" | "GESTOR" | "COMERCIAL" | "OPERACIONAL";

const navItems: { href: string; label: string; icon: React.ElementType; roles?: Role[] }[] = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clientes",   label: "Clientes",   icon: Users },
  { href: "/tarefas",    label: "Tarefas",    icon: CheckSquare },
  { href: "/agenda",     label: "Agenda",     icon: Calendar },
  { href: "/chat",       label: "Chat",       icon: MessageSquare },
  { href: "/whatsapp",   label: "WhatsApp",   icon: MessageCircle, roles: ["DESENVOLVEDOR"] },
  { href: "/pesquisa",   label: "Pesquisa",   icon: Search },
];

const bottomNavItems: { href: string; label: string; icon: React.ElementType; roles?: Role[] }[] = [
  { href: "/orcamentos-tecnicos", label: "Orçamentos Técnicos", icon: Calculator, roles: ["DESENVOLVEDOR"] },
  { href: "/relatorios",    label: "Relatórios",   icon: BarChart3, roles: ["ADMINISTRADOR", "DESENVOLVEDOR", "GESTOR"] },
  { href: "/usuarios",      label: "Usuários",     icon: UserCog,   roles: ["ADMINISTRADOR", "DESENVOLVEDOR"] },
  { href: "/alerta",        label: "Alerta",       icon: Bell,      roles: ["ADMINISTRADOR", "DESENVOLVEDOR"] },
  { href: "/auditoria",     label: "Auditoria",    icon: Shield,    roles: ["ADMINISTRADOR", "DESENVOLVEDOR"] },
  { href: "/configuracoes", label: "Configurações",icon: Settings },
];

// Accent pode ser um gradiente (recorta em texto) ou uma cor sólida.
function accentStyle(accent: string): React.CSSProperties {
  return accent.includes("gradient")
    ? { background: accent, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
    : { color: accent };
}

function NavLink({
  href, label, icon: Icon, active, collapsed, onClick, badgeCount, theme,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean; onClick?: () => void; badgeCount?: number; theme?: DevTheme;
}) {
  const showBadge = !!badgeCount && badgeCount > 0;
  const badgeText = badgeCount && badgeCount > 9 ? "9+" : String(badgeCount);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={onClick}
          className={cn(
            "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            theme
              ? active ? "text-white" : "hover:text-white hover:bg-white/[0.04]"
              : active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10",
            collapsed && "justify-center px-2"
          )}
          style={theme ? { background: active ? theme.navActiveBg : undefined, color: active ? "#fff" : theme.muted } : undefined}
        >
          {active && theme?.navIndicator && (
            <span
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
              style={{ background: theme.navIndicator, boxShadow: `0 0 8px ${theme.totalLineColor}` }}
            />
          )}
          <div className="relative">
            <Icon className="w-5 h-5 shrink-0" />
            {showBadge && collapsed && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-1 ring-sidebar">
                {badgeText}
              </span>
            )}
          </div>
          {!collapsed && <span>{label}</span>}
          {!collapsed && showBadge && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1.5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full">
              {badgeText}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}

// Tracks how many clients were added since the user last visited /clientes.
function useNewClientesCount() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  // Initialize localStorage key for this user (first visit = save now, no badge on old clients)
  useEffect(() => {
    if (!user?.id) return;
    const key = `lastClientsView_${user.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, new Date().toISOString());
    }
    setHydrated(true);
  }, [user?.id]);

  // When user visits /clientes, mark all clients as seen
  useEffect(() => {
    if (!user?.id || !hydrated) return;
    if (pathname.startsWith("/clientes")) {
      localStorage.setItem(`lastClientsView_${user.id}`, new Date().toISOString());
    }
  }, [pathname, user?.id, hydrated]);

  const isOnClientes = pathname.startsWith("/clientes");

  const { data: novosData } = useQuery({
    queryKey: ["clientes-novos", user?.id],
    queryFn: async () => {
      const since = localStorage.getItem(`lastClientsView_${user?.id}`);
      const params = since ? `?since=${encodeURIComponent(since)}` : "";
      const { data } = await axios.get(`/api/clientes/novos${params}`);
      return data as { count: number };
    },
    enabled: !!user?.id && hydrated && !isOnClientes,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // Toca um som quando a contagem sobe durante a sessão (cliente novo chegou agora) — não na
  // primeira leitura, pra não apitar por clientes que já estavam sem ver desde antes.
  const contagemAnterior = useRef<number | null>(null);
  useEffect(() => {
    const atual = novosData?.count;
    if (atual === undefined) return;
    if (contagemAnterior.current !== null && atual > contagemAnterior.current) {
      tocarNotificacaoNovoCliente();
    }
    contagemAnterior.current = atual;
  }, [novosData?.count]);

  return isOnClientes ? 0 : (novosData?.count ?? 0);
}

// Não lidas do chat interno (canal geral + DMs) — mesmo endpoint que a própria página
// /chat usa (["chat-resumo"]), então os dois compartilham o cache do React Query.
function useChatNaoLidas() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOnChat = pathname.startsWith("/chat");

  const { data } = useQuery({
    queryKey: ["chat-resumo"],
    queryFn: async () => {
      const { data } = await axios.get("/api/chat/conversas");
      return data as { totalNaoLidas: number };
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  return isOnChat ? 0 : (data?.totalNaoLidas ?? 0);
}

// Prefixes the browser tab title with "(N)" while there are unseen new clients,
// the same pattern WhatsApp Web uses for unread messages.
function useDocumentTitleBadge(count: number) {
  useEffect(() => {
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    const prefixPattern = /^\(\d+\)\s/;
    const applyPrefix = () => {
      const base = document.title.replace(prefixPattern, "");
      const next = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };

    applyPrefix();
    // Next.js sets document.title on every navigation; re-apply our prefix whenever it does.
    const observer = new MutationObserver(applyPrefix);
    observer.observe(titleEl, { childList: true });
    return () => observer.disconnect();
  }, [count]);
}

function SidebarContent({
  collapsed, onLinkClick, newClientesCount, chatNaoLidas, theme,
}: {
  collapsed: boolean; onLinkClick?: () => void; newClientesCount: number; chatNaoLidas: number; theme?: DevTheme;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const visibleTop = navItems.filter(
    (item) => !item.roles || (!loading && item.roles.includes((user?.role ?? "") as Role))
  );

  const visibleBottom = loading
    ? []
    : bottomNavItems.filter(
        (item) => !item.roles || item.roles.includes((user?.role ?? "") as Role)
      );

  return (
    <ScrollArea className="flex-1 py-4">
      <nav className="px-2 space-y-1">
        {visibleTop.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <NavLink
              key={item.href}
              {...item}
              active={active}
              collapsed={collapsed}
              onClick={onLinkClick}
              theme={theme}
              badgeCount={item.href === "/clientes" ? newClientesCount : item.href === "/chat" ? chatNaoLidas : undefined}
            />
          );
        })}
      </nav>

      {!loading && visibleBottom.length > 0 && (
        <div
          className={cn("mt-4 mx-2 border-t pt-4", !theme && "border-sidebar-border")}
          style={theme ? { borderColor: theme.sidebarBorder } : undefined}
        >
          <nav className="space-y-1">
            {visibleBottom.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <NavLink key={item.href} {...item} active={active} collapsed={collapsed} onClick={onLinkClick} theme={theme} />
              );
            })}
          </nav>
        </div>
      )}
    </ScrollArea>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, closeMobile } = useSidebar();
  const { isThemed, theme } = useDevTheme();
  const activeTheme = isThemed ? theme : undefined;
  const newClientesCount = useNewClientesCount();
  const chatNaoLidas = useChatNaoLidas();
  useDocumentTitleBadge(newClientesCount);

  const logo = (
    <div
      className={cn("flex items-center h-16 border-b shrink-0", !activeTheme && "border-sidebar-border", collapsed ? "justify-center px-2" : "gap-3 px-4")}
      style={activeTheme ? { borderColor: activeTheme.sidebarBorder } : undefined}
    >
      <Logo height={collapsed ? 28 : 40} className={activeTheme ? undefined : "invert dark:invert-0"} />
      {!collapsed && (
        <span className="font-black text-base truncate tracking-wide" style={activeTheme ? { fontFamily: activeTheme.fontVar } : undefined}>
          <span style={activeTheme ? { color: activeTheme.text } : undefined} className={activeTheme ? undefined : "text-sidebar-foreground"}>INFINITY</span>
          <span
            className={cn("ml-1", !activeTheme && "text-blue-400")}
            style={activeTheme ? accentStyle(activeTheme.navIndicator ?? activeTheme.totalLineColor) : undefined}
          >
            GLASS
          </span>
        </span>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "relative hidden lg:flex flex-col border-r transition-all duration-300 ease-in-out",
          !activeTheme && "bg-sidebar text-sidebar-foreground border-sidebar-border",
          collapsed ? "w-16" : "w-64"
        )}
        style={activeTheme ? { background: activeTheme.sidebarBg, borderColor: activeTheme.sidebarBorder, color: activeTheme.text } : undefined}
      >
        {activeTheme?.sidebarEdge && (
          <div
            className="absolute top-0 right-[-1px] bottom-0 w-px pointer-events-none opacity-60"
            style={{ background: activeTheme.sidebarEdge }}
          />
        )}
        {logo}
        <SidebarContent collapsed={collapsed} newClientesCount={newClientesCount} chatNaoLidas={chatNaoLidas} theme={activeTheme} />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center hover:bg-accent transition-colors shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 flex flex-col border-r transition-transform duration-300 ease-in-out lg:hidden",
          !activeTheme && "bg-sidebar text-sidebar-foreground border-sidebar-border",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={activeTheme ? { background: activeTheme.sidebarBg, borderColor: activeTheme.sidebarBorder, color: activeTheme.text } : undefined}
      >
        <div
          className={cn("flex items-center justify-between h-16 px-4 border-b shrink-0", !activeTheme && "border-sidebar-border")}
          style={activeTheme ? { borderColor: activeTheme.sidebarBorder } : undefined}
        >
          <div className="flex items-center gap-3">
            <Logo height={40} className={activeTheme ? undefined : "invert dark:invert-0"} />
            <span className="font-black text-base tracking-wide" style={activeTheme ? { fontFamily: activeTheme.fontVar } : undefined}>
              <span>INFINITY</span>
              <span
                className={cn("ml-1", !activeTheme && "text-blue-400")}
                style={activeTheme ? accentStyle(activeTheme.navIndicator ?? activeTheme.totalLineColor) : undefined}
              >
                GLASS
              </span>
            </span>
          </div>
          <button onClick={closeMobile} className="p-1.5 rounded-lg hover:bg-sidebar-foreground/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent collapsed={false} onLinkClick={closeMobile} newClientesCount={newClientesCount} chatNaoLidas={chatNaoLidas} theme={activeTheme} />
      </aside>
    </TooltipProvider>
  );
}
