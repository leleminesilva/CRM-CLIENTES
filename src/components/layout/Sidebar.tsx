"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users,
  CheckSquare, Calendar, BarChart3, UserCog,
  Settings, ChevronLeft, ChevronRight, Shield, X, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
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
  { href: "/whatsapp",   label: "WhatsApp",   icon: MessageCircle, roles: ["ADMINISTRADOR"] },
];

const bottomNavItems: { href: string; label: string; icon: React.ElementType; roles?: Role[] }[] = [
  { href: "/relatorios",    label: "Relatórios",   icon: BarChart3, roles: ["ADMINISTRADOR", "GESTOR"] },
  { href: "/usuarios",      label: "Usuários",     icon: UserCog,   roles: ["ADMINISTRADOR"] },
  { href: "/auditoria",     label: "Auditoria",    icon: Shield,    roles: ["ADMINISTRADOR"] },
  { href: "/configuracoes", label: "Configurações",icon: Settings },
];

function NavLink({
  href, label, icon: Icon, active, collapsed, onClick, badge,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean; onClick?: () => void; badge?: boolean;
}) {
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
            {badge && collapsed && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-1 ring-sidebar" />
            )}
          </div>
          {!collapsed && <span>{label}</span>}
          {!collapsed && badge && (
            <span className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}

function SidebarContent({ collapsed, onLinkClick }: { collapsed: boolean; onLinkClick?: () => void }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
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
    staleTime: 0,
  });

  const hasNewClientes = !isOnClientes && (novosData?.count ?? 0) > 0;

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
              badge={item.href === "/clientes" && hasNewClientes}
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

  const logo = (
    <div className={cn("flex items-center h-16 px-4 border-b border-sidebar-border shrink-0", collapsed ? "justify-center" : "gap-3")}>
      <svg width="32" height="32" viewBox="0 0 100 100" fill="none" className="shrink-0">
        <defs>
          <linearGradient id="sg-inner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c8e8f8" />
            <stop offset="100%" stopColor="#5aace0" />
          </linearGradient>
        </defs>
        <rect x="19" y="19" width="62" height="62" rx="13" transform="rotate(45 50 50)" fill="rgba(42,68,105,0.60)" />
        <rect x="27" y="27" width="46" height="46" rx="10" transform="rotate(45 50 50)" fill="rgba(72,108,155,0.72)" />
        <rect x="36" y="36" width="28" height="28" rx="6" transform="rotate(45 50 50)" fill="url(#sg-inner)" />
      </svg>
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
        <SidebarContent collapsed={collapsed} />

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
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="mg-inner" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c8e8f8" />
                  <stop offset="100%" stopColor="#5aace0" />
                </linearGradient>
              </defs>
              <rect x="19" y="19" width="62" height="62" rx="13" transform="rotate(45 50 50)" fill="rgba(42,68,105,0.60)" />
              <rect x="27" y="27" width="46" height="46" rx="10" transform="rotate(45 50 50)" fill="rgba(72,108,155,0.72)" />
              <rect x="36" y="36" width="28" height="28" rx="6" transform="rotate(45 50 50)" fill="url(#mg-inner)" />
            </svg>
            <span className="font-black text-base tracking-wide">
              <span>INFINITY</span>
              <span className="text-blue-400 ml-1">GLASS</span>
            </span>
          </div>
          <button onClick={closeMobile} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent collapsed={false} onLinkClick={closeMobile} />
      </aside>
    </TooltipProvider>
  );
}
