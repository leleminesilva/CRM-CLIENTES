import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import type { IncomeClassTotals } from "../queries";

const LABELS = {
  BASE: "Base (salário)",
  COMMISSION: "Comissões",
  EXTRA: "Renda extra",
  OTHER: "Outros recebimentos",
} as const;

/** Renda do mês separada por classe: Base · Comissões · Renda extra · Outros. */
export function IncomeClassCards({
  classes,
  total,
}: {
  classes: IncomeClassTotals[];
  total: string;
}) {
  return (
    <Panel className="grid divide-y divide-line sm:grid-cols-5 sm:divide-x sm:divide-y-0">
      <div className="grid content-start gap-1 bg-surface-sunken/50 px-5 py-4 sm:rounded-l-card">
        <span className="text-[13px] text-ink-2">Total previsto</span>
        <MoneyText value={total} variant="kpi" />
      </div>
      {classes.map((c) => (
        <div key={c.incomeClass} className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">{LABELS[c.incomeClass]}</span>
          <MoneyText value={c.total} variant="table" className="text-lg font-medium" />
          <span className="text-xs text-ink-3">
            <MoneyText value={c.settled} /> recebido
          </span>
        </div>
      ))}
    </Panel>
  );
}
