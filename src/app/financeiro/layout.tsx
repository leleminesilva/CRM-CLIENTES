import { FinanceiroSidebar } from "@/components/layout/FinanceiroSidebar";
import { FinanceiroTopbar } from "@/components/layout/FinanceiroTopbar";
import { SidebarProvider } from "@/contexts/SidebarContext";

// Layout isolado do Financeiro: não usa o Sidebar/Topbar do CRM de propósito,
// pra não misturar os dois "sistemas" na mesma tela.
export default function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
