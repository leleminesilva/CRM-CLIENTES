"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, BarChart3, Landmark, Building2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/Logo";
import { useSidebar } from "@/contexts/SidebarContext";

// Sidebar própria do Financeiro — separada da <Sidebar> do CRM de propósito
// (o usuário não quer ver o menu do CRM enquanto está no Financeiro). Conforme
// novas telas forem sendo criadas dentro do Financeiro, é só ir adicionando
// itens aqui.
const navItems: { href: string; label: string; icon: React.ElementType }[] = [
  { href: "/financeiro", label: "Visão geral", icon: LayoutDashboard },
  { href: "/financeiro/caixa", label: "Caixa", icon: ArrowLeftRight },
  { href: "/financeiro/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/financeiro/contas", label: "Contas", icon: Landmark },
];

function NavLink({
  href, label, icon: Icon, active, collapsed, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function SidebarContent({ collapsed, onLinkClick }: { collapsed: boolean; onLinkClick?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-2 py-4 space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          {...item}
          active={pathname === item.href}
          collapsed={collapsed}
          onClick={onLinkClick}
        />
      ))}
    </nav>
  );
}

function VoltarAoCrm({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-3 mx-2 mb-3 px-3 py-2.5 rounded-lg text-sm font-medium border border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 transition-colors",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? "Voltar para o CRM" : undefined}
    >
      <Building2 className="w-4 h-4 shrink-0" />
      {!collapsed && <span>Voltar para o CRM</span>}
    </Link>
  );
}

export function FinanceiroSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, closeMobile } = useSidebar();

  const logo = (
    <div className={cn("flex items-center h-16 border-b border-sidebar-border shrink-0", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
      <Logo height={collapsed ? 28 : 40} className="invert dark:invert-0" />
      {!collapsed && (
        <span className="font-black text-base truncate tracking-wide text-sidebar-foreground">
          INFINITY<span className="ml-1 text-emerald-500">GLASS</span>
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "relative hidden lg:flex flex-col h-svh shrink-0 border-r bg-sidebar text-sidebar-foreground border-sidebar-border transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {logo}
        <SidebarContent collapsed={collapsed} />
        <VoltarAoCrm collapsed={collapsed} />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center hover:bg-accent transition-colors shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={closeMobile} />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 flex flex-col border-r bg-sidebar text-sidebar-foreground border-sidebar-border transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <Logo height={40} className="invert dark:invert-0" />
            <span className="font-black text-base tracking-wide">
              INFINITY<span className="ml-1 text-emerald-500">GLASS</span>
            </span>
          </div>
          <button onClick={closeMobile} className="p-1.5 rounded-lg hover:bg-sidebar-foreground/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent collapsed={false} onLinkClick={closeMobile} />
        <VoltarAoCrm collapsed={false} />
      </aside>
    </>
  );
}
