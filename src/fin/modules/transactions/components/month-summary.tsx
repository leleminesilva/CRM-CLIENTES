import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { cn } from "@fin/lib/cn";
import type { MonthTotals } from "../types";

function Cell({
  label,
  value,
  lines,
  className,
}: {
  label: string;
  value: React.ReactNode;
  lines?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1 px-5 py-4", className)}>
      <span className="text-[13px] text-ink-2">{label}</span>
      {value}
      {lines ? <span className="text-xs leading-5 text-ink-3">{lines}</span> : null}
    </div>
  );
}

/** Resumo do mês pela regra de ouro (vencimento no mês): previsto, realizado e vencido. */
export function MonthSummary({ totals }: { totals: MonthTotals }) {
  const overdue = (v: string) => Number.parseFloat(v) > 0;
  return (
    <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Cell
        label="Receitas do mês"
        value={<MoneyText value={totals.income.total} variant="kpi" />}
        lines={
          <>
            <MoneyText value={totals.income.settled} /> recebido ·{" "}
            <MoneyText value={totals.income.pending} /> a receber
            {overdue(totals.income.overdue) ? (
              <>
                {" "}
                ·{" "}
                <span className="text-critical">
                  <MoneyText value={totals.income.overdue} /> atrasado
                </span>
              </>
            ) : null}
          </>
        }
      />
      <Cell
        label="Despesas do mês"
        value={<MoneyText value={totals.expense.total} variant="kpi" />}
        lines={
          <>
            <MoneyText value={totals.expense.settled} /> pago ·{" "}
            <MoneyText value={totals.expense.pending} /> a pagar
            {overdue(totals.expense.overdue) ? (
              <>
                {" "}
                ·{" "}
                <span className="text-critical">
                  <MoneyText value={totals.expense.overdue} /> vencido
                </span>
              </>
            ) : null}
          </>
        }
      />
      <Cell
        label="Resultado previsto"
        value={
          <MoneyText
            value={totals.result}
            variant="kpi"
            sign="always"
            tone={totals.result.startsWith("-") ? "critical" : "positive"}
          />
        }
        lines={
          <>
            Realizado até agora: <MoneyText value={totals.settledResult} sign="always" />
          </>
        }
      />
    </Panel>
  );
}
