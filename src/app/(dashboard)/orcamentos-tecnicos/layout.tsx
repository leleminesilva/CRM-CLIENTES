"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

const SUBNAV = [
  { href: "/orcamentos-tecnicos/orcamentos", label: "Orçamentos" },
  { href: "/orcamentos-tecnicos/ordens-servico", label: "Ordens de Serviço" },
  { href: "/orcamentos-tecnicos/sobras-material", label: "Sobras de Material" },
  { href: "/orcamentos-tecnicos/catalogo", label: "Catálogo" },
];

export default function OrcamentosTecnicosLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isDev = user?.role === "DESENVOLVEDOR";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user && !isDev) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Calculator className="w-16 h-16 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-xl font-semibold">Acesso restrito</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            O módulo Orçamentos Técnicos está disponível apenas para o cargo Desenvolvedor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <nav className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {SUBNAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
