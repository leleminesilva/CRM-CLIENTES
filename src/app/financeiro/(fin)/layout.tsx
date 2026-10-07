import type * as React from "react";
import { DiscreetProvider } from "@fin/components/layout/discreet";
import { TooltipProvider } from "@fin/components/ui/tooltip";
import { requirePageContext } from "@fin/lib/context";
import { refreshAlerts } from "@fin/modules/alerts/service";
import { triggerDailyJobs } from "@fin/modules/jobs/runner";
import { TransactionFormProvider } from "@fin/modules/transactions/components/transaction-form-provider";
import { loadFormOptions } from "@fin/modules/transactions/queries";

// Escrito à mão para o CRM (a conversão não sobrescreve: ver HANDWRITTEN em scripts/fin-portar.py).
// A casca (sidebar, topbar, checagem de acesso no navegador) é a de src/app/financeiro/layout.tsx;
// aqui fica o que o Financeiro novo precisa do servidor em toda página.
export default async function FinLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageContext();
  const formOptions = await loadFormOptions(ctx);
  await refreshAlerts(ctx, ctx.today);
  // Primeira visita do dia dispara recorrências, faturas, snapshots e lixeira em segundo plano.
  // (No sistema original isso rodava em after(), que o Next 14 não tem de forma estável.)
  triggerDailyJobs();

  return (
    <TooltipProvider delayDuration={300}>
      <DiscreetProvider>
        <TransactionFormProvider options={formOptions} today={ctx.today}>
          <div className="mx-auto w-full max-w-[1440px] pb-12">{children}</div>
        </TransactionFormProvider>
      </DiscreetProvider>
    </TooltipProvider>
  );
}
