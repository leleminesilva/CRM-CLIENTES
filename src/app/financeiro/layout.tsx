"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FinanceiroSidebar } from "@/components/layout/FinanceiroSidebar";
import { FinanceiroTopbar } from "@/components/layout/FinanceiroTopbar";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFinanceiro } from "@/lib/rbac";

// Layout isolado do Financeiro: não usa o Sidebar/Topbar do CRM de propósito,
// pra não misturar os dois "sistemas" na mesma tela.
//
// O controle de acesso mora aqui (não em cada página) pra quem não tem
// permissão nem chegar a ver a casca verde do Financeiro — some direto pra
// área inicial do CRM com um aviso, em vez de mostrar "Acesso negado" dentro
// do módulo.
export default function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const avisou = useRef(false);

  const semAcesso = !loading && !canAccessFinanceiro(user);
  useEffect(() => {
    if (semAcesso && !avisou.current) {
      avisou.current = true;
      toast.error("Você não tem acesso ao Financeiro. Peça a um administrador para liberar em Usuários.");
      router.replace("/");
    }
  }, [semAcesso, router]);

  if (loading || semAcesso) return null;

  return (
    <SidebarProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        <FinanceiroSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <FinanceiroTopbar />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 scrollbar-thin overscroll-contain">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
