"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users,
  CheckSquare, Calendar, BarChart3, UserCog,
  Settings, ChevronLeft, ChevronRight, Shield, X, MessageCircle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

type Role = "ADMINISTRADOR" | "GESTOR" | "COMERCIAL" | "OPERACIONAL";

const navItems: { href: string; label: string; icon: React.ElementType; roles?: Role[] }[] = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clientes",   label: "Clientes",   icon: Users },
  { href: "/tarefas",    label: "Tarefas",    icon: CheckSquare },
  { href: "/agenda",     label: "Agenda",     icon: Calendar },
  { href: "/chat",       label: "Chat",       icon: MessageSquare },
  { href: "/whatsapp",   label: "WhatsApp",   icon: MessageCircle, roles: ["ADMINISTRADOR"] },
];

const bottomNavItems: { href: string; label: string; icon: React.ElementType; roles?: Role[] }[] = [
  { href: "/relatorios",    label: "Relatórios",   icon: BarChart3, roles: ["ADMINISTRADOR", "GESTOR"] },
  { href: "/usuarios",      label: "Usuários",     icon: UserCog,   roles: ["ADMINISTRADOR"] },
  { href: "/auditoria",     label: "Auditoria",    icon: Shield,    roles: ["ADMINISTRADOR"] },
  { href: "/configuracoes", label: "Configurações",icon: Settings },
];

function NavLink({
  href, label, icon: Icon, active, collapsed, onClick, badgeCount,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean; onClick?: () => void; badgeCount?: number;
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
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10",
            collapsed && "justify-center px-2"
          )}
        >
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
  collapsed, onLinkClick, newClientesCount, chatNaoLidas,
}: {
  collapsed: boolean; onLinkClick?: () => void; newClientesCount: number; chatNaoLidas: number;
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
              badgeCount={item.href === "/clientes" ? newClientesCount : item.href === "/chat" ? chatNaoLidas : undefined}
            />
          );
        })}
      </nav>

      {!loading && visibleBottom.length > 0 && (
        <div className="mt-4 mx-2 border-t border-sidebar-border pt-4">
          <nav className="space-y-1">
            {visibleBottom.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <NavLink key={item.href} {...item} active={active} collapsed={collapsed} onClick={onLinkClick} />
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
  const newClientesCount = useNewClientesCount();
  const chatNaoLidas = useChatNaoLidas();
  useDocumentTitleBadge(newClientesCount);

  const logo = (
    <div className={cn("flex items-center h-16 border-b border-sidebar-border shrink-0", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
      <Logo height={collapsed ? 28 : 40} />
      {!collapsed && (
        <span className="font-black text-base truncate tracking-wide">
          <span className="text-sidebar-foreground">INFINITY</span>
          <span className="text-blue-400 ml-1">GLASS</span>
        </span>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "relative hidden lg:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {logo}
        <SidebarContent collapsed={collapsed} newClientesCount={newClientesCount} chatNaoLidas={chatNaoLidas} />

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
          "fixed top-0 left-0 z-50 h-full w-72 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <Logo height={40} />
            <span className="font-black text-base tracking-wide">
              <span>INFINITY</span>
              <span className="text-blue-400 ml-1">GLASS</span>
            </span>
          </div>
          <button onClick={closeMobile} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent collapsed={false} onLinkClick={closeMobile} newClientesCount={newClientesCount} chatNaoLidas={chatNaoLidas} />
      </aside>
    </TooltipProvider>
  );
}
