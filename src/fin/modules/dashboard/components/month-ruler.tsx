import { MoneyText } from "@fin/components/shared/money-text";
import { cn } from "@fin/lib/cn";
import { formatMoney, formatPercent, ratio, toMoney } from "@fin/lib/money";

interface MonthRulerProps {
  incomeTotal: string;
  incomeSettled: string;
  expenseTotal: string;
  expenseSettled: string;
  monthLabel: string;
}

function pct(value: string, scale: number) {
  return scale > 0 ? Math.max(0, Math.min(100, (Number.parseFloat(value) / scale) * 100)) : 0;
}

/**
 * Régua do mês (assinatura do DS §6): o mês inteiro numa linha — renda prevista, o que já foi
 * pago, o que falta pagar e quanto sobra. Previsto/pendente usa hachura (não depende de cor).
 */
export function MonthRuler({
  incomeTotal,
  incomeSettled,
  expenseTotal,
  expenseSettled,
  monthLabel,
}: MonthRulerProps) {
  const income = toMoney(incomeTotal);
  const expense = toMoney(expenseTotal);
  const scale = Math.max(income.toNumber(), expense.toNumber());
  const leftover = income.minus(expense);
  const over = leftover.isNegative();
  const commitment = ratio(expense, income);
  const incomeMark = pct(incomeTotal, scale);
  const expensePending = expense.minus(toMoney(expenseSettled));
  const incomePending = income.minus(toMoney(incomeSettled));

  const summary = `${monthLabel}: receitas previstas ${formatMoney(income)}, recebido ${formatMoney(incomeSettled)}. Despesas previstas ${formatMoney(expense)}, pago ${formatMoney(expenseSettled)}. ${over ? `Faltam ${formatMoney(leftover.abs())}` : `Sobra prevista ${formatMoney(leftover)}`}. Comprometimento ${formatPercent(commitment)}.`;

  if (scale === 0) {
    return (
      <div className="grid gap-2">
        <span className="text-[13px] text-ink-2">Régua do mês</span>
        <div className="h-3 rounded-full bg-surface-sunken" />
        <p className="text-[13px] text-ink-3">
          Cadastre receitas e despesas do mês para ver quanto sobra.
        </p>
      </div>
    );
  }

  const bar = (settled: string, total: string, series: "income" | "expense") => {
    const settledW = pct(settled, scale);
    const totalW = pct(total, scale);
    const color = series === "income" ? "var(--series-income)" : "var(--series-expense)";
    const overflowStart = series === "expense" && over ? incomeMark : null;
    return (
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="ruler-grow absolute inset-y-0 left-0 rounded-l-full"
          style={{ width: `${settledW}%`, backgroundColor: color }}
        />
        <div
          className="ruler-grow absolute inset-y-0 hatched"
          style={{
            left: `calc(${settledW}% + 2px)`,
            width: `max(0px, calc(${totalW - settledW}% - 2px))`,
            color,
            backgroundColor: `color-mix(in oklab, ${color} 22%, var(--surface))`,
          }}
        />
        {overflowStart !== null ? (
          <div
            className="absolute inset-y-0 bg-status-critical"
            style={{ left: `${overflowStart}%`, width: `${totalW - overflowStart}%` }}
          />
        ) : null}
      </div>
    );
  };

  return (
    <figure className="grid gap-3" aria-label="Régua do mês">
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="flex items-baseline justify-between gap-3" aria-hidden>
        <span className="text-[13px] text-ink-2">Régua do mês</span>
        <span
          className={cn(
            "text-[13px]",
            commitment && commitment.greaterThan(0.9) ? "font-medium text-critical" : "text-ink-2",
          )}
        >
          Comprometido{" "}
          <span className="font-semibold text-ink nums">{formatPercent(commitment)}</span> da renda
        </span>
      </div>
      <div className="relative grid gap-2" aria-hidden>
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
          <span className="text-xs text-ink-3">Receitas</span>
          {bar(incomeSettled, incomeTotal, "income")}
        </div>
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
          <span className="text-xs text-ink-3">Despesas</span>
          {bar(expenseSettled, expenseTotal, "expense")}
        </div>
        {/* Marca dos 100% da renda prevista */}
        <div className="pointer-events-none absolute -top-1 right-0 -bottom-1 left-[calc(4.5rem+0.75rem)]">
          <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${incomeMark}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-hidden>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-series-income align-middle" />
          Recebido <MoneyText value={incomeSettled} className="font-medium text-ink" />
          {incomePending.greaterThan(0) ? (
            <>
              {" "}
              · a receber <MoneyText value={incomePending} />
            </>
          ) : null}
        </span>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-series-expense align-middle" />
          Pago <MoneyText value={expenseSettled} className="font-medium text-ink" />
          {expensePending.greaterThan(0) ? (
            <>
              {" "}
              · a pagar <MoneyText value={expensePending} />
            </>
          ) : null}
        </span>
        <span className={cn("ml-auto font-medium", over ? "text-critical" : "text-ink")}>
          {over ? "Faltam " : "Sobra "}
          <MoneyText value={leftover.abs()} />
        </span>
      </div>
    </figure>
  );
}
