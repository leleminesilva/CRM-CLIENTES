"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bell, Sun, Moon, Search, LogOut, User, Settings, ChevronDown, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
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
import { ROLE_LABELS } from "@/lib/utils/formatters";
import { useSidebar } from "@/contexts/SidebarContext";

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
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { openMobile } = useSidebar();

  const pageTitle =
    Object.entries(BREADCRUMBS).find(([path]) => pathname.startsWith(path) && (path === "/" ? pathname === "/" : true))?.[1] ||
    "CRM Clientes";

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
          {mounted
            ? theme === "dark"
              ? <Sun className="w-5 h-5" />
              : <Moon className="w-5 h-5" />
            : <Moon className="w-5 h-5" />
          }
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

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
