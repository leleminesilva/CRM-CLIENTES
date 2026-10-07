"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartFrame, ChartTable } from "@fin/components/charts/chart-frame";
import { CashFlowChart } from "@fin/components/charts/cash-flow-chart";
import { ChartLegend } from "@fin/components/charts/income-expense-chart";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { Segmented } from "@fin/components/ui/segmented";
import { formatDate, formatDayMonth, formatMonth } from "@fin/lib/dates";
import { formatMoney, sumMoney } from "@fin/lib/money";
import type { Granularity } from "../domain/buckets";

export interface BucketDTO {
  key: string;
  start: string;
  end: string;
  opening: string;
  income: string;
  expense: string;
  applications: string;
  adjustments: string;
  net: string;
  closing: string;
  projected: boolean;
  partial: boolean;
}

function label(b: BucketDTO, g: Granularity) {
  if (g === "day") return formatDayMonth(b.start);
  if (g === "week") return `${formatDayMonth(b.start)}–${formatDayMonth(b.end)}`;
  if (g === "month") return formatMonth(b.key, "short");
  return b.key;
}

export function CashFlowView({
  buckets,
  granularity,
  from,
  to,
}: {
  buckets: BucketDTO[];
  granularity: Granularity;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key === "visao") {
      next.delete("de");
      next.delete("ate");
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const first = buckets[0];
  const last = buckets.at(-1);
  const totalIn = sumMoney(buckets.map((b) => b.income));
  const totalOut = sumMoney(buckets.map((b) => b.expense));
  const lowest = buckets.reduce(
    (m, b) => (Number(b.closing) < Number(m.closing) ? b : m),
    buckets[0]!,
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          aria-label="Agrupar por"
          value={granularity}
          onValueChange={(v) => set("visao", v)}
          options={[
            { value: "day", label: "Diário" },
            { value: "week", label: "Semanal" },
            { value: "month", label: "Mensal" },
            { value: "year", label: "Anual" },
          ]}
        />
        <label className="grid gap-1 text-xs text-ink-3">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && set("de", e.target.value)}
            className="h-9 rounded-control border border-line-strong bg-surface px-2 text-sm text-ink"
          />
        </label>
        <label className="grid gap-1 text-xs text-ink-3">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && set("ate", e.target.value)}
            className="h-9 rounded-control border border-line-strong bg-surface px-2 text-sm text-ink"
          />
        </label>
      </div>

      <Panel className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Saldo inicial</span>
          <MoneyText value={first?.opening ?? "0"} variant="kpi" />
          <span className="text-xs text-ink-3">em {first ? formatDate(first.start) : "—"}</span>
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">+ Entradas</span>
          <MoneyText value={totalIn} variant="kpi" tone="positive" />
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">− Saídas</span>
          <MoneyText value={totalOut} variant="kpi" />
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">= Saldo final</span>
          <MoneyText
            value={last?.closing ?? "0"}
            variant="kpi"
            tone={last?.closing.startsWith("-") ? "critical" : "default"}
          />
          <span className="text-xs text-ink-3">em {last ? formatDate(last.end) : "—"}</span>
        </div>
      </Panel>

      <ChartFrame
        question="Como o caixa se comporta no período?"
        answer={
          Number(lowest.closing) < 0
            ? `O saldo fica negativo em ${label(lowest, granularity)} (${formatMoney(lowest.closing)}).`
            : `O ponto mais baixo é ${formatMoney(lowest.closing)}, em ${label(lowest, granularity)}.`
        }
        chart={
          <div className="grid gap-3">
            <ChartLegend
              items={[
                { label: "Entradas", color: "var(--series-income)" },
                { label: "Saídas", color: "var(--series-expense)" },
                { label: "Saldo final", color: "var(--ink)", line: true },
              ]}
            />
            <CashFlowChart
              data={buckets.map((b) => ({
                key: b.key,
                label: label(b, granularity),
                income: Number(b.income),
                expense: Number(b.expense),
                closing: Number(b.closing),
                projected: b.projected,
              }))}
            />
          </div>
        }
        table={
          <ChartTable
            head={["Período", "Saldo inicial", "Entradas", "Saídas", "Saldo final"]}
            rows={buckets.map((b) => [
              `${label(b, granularity)}${b.projected ? " · previsto" : b.partial ? " · em andamento" : ""}`,
              formatMoney(b.opening),
              formatMoney(b.income),
              formatMoney(b.expense),
              formatMoney(b.closing),
            ])}
          />
        }
        footnote="Realizado pela data de pagamento/recebimento; previsto pelo vencimento (atrasados contam a partir de hoje). Cartão: a fatura sai no vencimento. Aplicações na reserva saem do disponível, mas não são despesa."
      />

      <Panel
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela do fluxo de caixa por período"
      >
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Período</th>
              <th className="px-3 py-2.5 text-right font-medium">Saldo inicial</th>
              <th className="px-3 py-2.5 text-right font-medium">Entradas</th>
              <th className="px-3 py-2.5 text-right font-medium">Saídas</th>
              <th className="px-3 py-2.5 text-right font-medium">Aplicações</th>
              <th className="px-4 py-2.5 text-right font-medium">Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key} className="border-b border-line last:border-0">
                <td className="px-4 py-2 first-letter:uppercase">
                  {label(b, granularity)}
                  {b.projected ? (
                    <span className="ml-2 text-xs text-ink-3">previsto</span>
                  ) : b.partial ? (
                    <span className="ml-2 text-xs text-ink-3">em andamento</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <MoneyText value={b.opening} variant="table" tone="muted" />
                </td>
                <td className="px-3 py-2 text-right">
                  <MoneyText
                    value={b.income}
                    variant="table"
                    tone={b.income === "0.00" ? "muted" : "positive"}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <MoneyText value={b.expense} variant="table" />
                </td>
                <td className="px-3 py-2 text-right">
                  <MoneyText value={b.applications} variant="table" tone="muted" />
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  <MoneyText
                    value={b.closing}
                    variant="table"
                    tone={b.closing.startsWith("-") ? "critical" : "default"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
