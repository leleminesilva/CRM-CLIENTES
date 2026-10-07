import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { formatPercent } from "@fin/lib/money";
import type { FixedExpensesSummary } from "../queries";

/** Despesas fixas (R5): mensal, anual e quanto da renda elas comprometem. */
export function FixedExpensesSummaryCards({ summary }: { summary: FixedExpensesSummary }) {
  const share = summary.shareOfBase;
  return (
    <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div className="grid content-start gap-1 px-5 py-4">
        <span className="text-[13px] text-ink-2">Despesas fixas mensais</span>
        <MoneyText value={summary.monthly} variant="kpi" />
        <span className="text-xs text-ink-3">Fixas com vencimento neste mês</span>
      </div>
      <div className="grid content-start gap-1 px-5 py-4">
        <span className="text-[13px] text-ink-2">Despesas fixas anuais</span>
        <MoneyText value={summary.yearly} variant="kpi" />
        <span className="text-xs text-ink-3">
          Próximos 12 meses, incluindo as que não são mensais
        </span>
      </div>
      <div className="grid content-start gap-1 px-5 py-4">
        <span className="text-[13px] text-ink-2">Da receita principal comprometida</span>
        <span className="figure-kpi">{share ? formatPercent(share) : "—"}</span>
        <span className="text-xs text-ink-3">
          {share ? (
            <>
              <MoneyText value={summary.monthly} /> de <MoneyText value={summary.baseIncome} /> de
              receita principal
            </>
          ) : (
            "Cadastre a receita principal recorrente para ver este indicador"
          )}
        </span>
      </div>
    </Panel>
  );
}
