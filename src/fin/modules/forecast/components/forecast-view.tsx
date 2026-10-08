"use client";

import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartFrame, ChartTable } from "@fin/components/charts/chart-frame";
import { ChartLegend } from "@fin/components/charts/income-expense-chart";
import { ForecastChart } from "@fin/components/charts/forecast-chart";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { Segmented } from "@fin/components/ui/segmented";
import { Tooltip } from "@fin/components/ui/tooltip";
import { formatMonth } from "@fin/lib/dates";
import { formatMoney, sumMoney, toMoneyString } from "@fin/lib/money";
import { SCENARIO_LABEL, type Scenario } from "../domain/project";
import type { ForecastResult } from "../queries";

export function ForecastView({ data, horizon }: { data: ForecastResult; horizon: 3 | 6 | 12 }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const neg = data.firstNegative;
  const last = data.months.at(-1);
  const points = data.months.map((m, i) => {
    const values = [data.bands.conservative[i]!, data.bands.optimistic[i]!].map(Number);
    return {
      month: m.month,
      closing: Number(m.closing),
      band: [Math.min(...values), Math.max(...values)] as [number, number],
    };
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented
          aria-label="Horizonte"
          value={String(horizon)}
          onValueChange={(v) => set("meses", v)}
          options={[
            { value: "3", label: "3 meses" },
            { value: "6", label: "6 meses" },
            { value: "12", label: "12 meses" },
          ]}
        />
        <Segmented
          aria-label="Cenário de comissões"
          value={data.scenario}
          onValueChange={(v) => set("cenario", v)}
          options={(["conservative", "realistic", "optimistic"] as Scenario[]).map((s) => ({
            value: s,
            label: SCENARIO_LABEL[s],
          }))}
        />
        <Tooltip content="Os cenários só mudam as comissões que ainda não foram cadastradas: conservador usa o 25º percentil dos últimos 12 meses, realista a mediana e otimista o 75º.">
          <button
            type="button"
            className="mb-1.5 inline-flex cursor-help items-center gap-1 text-xs text-ink-3"
            aria-label="Como os cenários funcionam"
          >
            <InfoIcon className="size-3.5" /> Como funcionam os cenários
          </button>
        </Tooltip>
      </div>

      {neg ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card border border-status-critical/40 bg-status-critical/10 px-4 py-3"
        >
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
          <div className="grid gap-0.5">
            <span className="text-sm font-semibold text-critical">
              O caixa pode ficar negativo em {formatMonth(neg.month)}
            </span>
            <span className="text-[13px] text-ink-2">
              No cenário {SCENARIO_LABEL[data.scenario].toLowerCase()}, o saldo projetado chega a{" "}
              {formatMoney(neg.closing)}. Reveja despesas desse mês, antecipe recebimentos ou use a
              reserva.
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
          <span className="text-[13px] text-ink-2">
            Nos próximos {horizon} meses o caixa não fica negativo no cenário{" "}
            {SCENARIO_LABEL[data.scenario].toLowerCase()}.
          </span>
        </div>
      )}

      <Panel className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Disponível hoje</span>
          <MoneyText value={data.opening} variant="kpi" />
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">
            Saldo em {last ? formatMonth(last.month, "short") : "—"}
          </span>
          <MoneyText
            value={last?.closing ?? "0"}
            variant="kpi"
            tone={last?.closing.startsWith("-") ? "critical" : "default"}
          />
          <span className="text-xs text-ink-3">
            cenário {SCENARIO_LABEL[data.scenario].toLowerCase()}
          </span>
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Despesas variáveis estimadas</span>
          <MoneyText value={data.variableAverage} variant="kpi" />
          <span className="text-xs text-ink-3">por mês, média de 6 meses</span>
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Comissão a pagar típica por mês</span>
          <MoneyText value={data.commissionTypical[data.scenario]} variant="kpi" />
          <span className="text-xs text-ink-3">
            {data.historyMonths >= 3
              ? `${data.historyMonths} meses com comissão no histórico`
              : "Histórico curto: sem complemento estimado"}
          </span>
        </div>
      </Panel>

      <ChartFrame
        question="Como estará meu caixa daqui a alguns meses?"
        answer={
          last
            ? `Saldo projetado de ${formatMoney(last.closing)} em ${formatMonth(last.month)}; a faixa mostra do cenário conservador ao otimista.`
            : undefined
        }
        chart={
          <div className="grid gap-3">
            <ChartLegend
              items={[
                { label: "Saldo projetado", color: "var(--ink)", line: true },
                { label: "Faixa conservador–otimista", color: "var(--series-commission)" },
              ]}
            />
            <ForecastChart data={points} />
          </div>
        }
        table={
          <ChartTable
            head={["Mês", "Receitas", "Despesas", "Resultado", "Saldo final"]}
            rows={data.months.map((m) => [
              formatMonth(m.month),
              formatMoney(m.income),
              formatMoney(m.expense),
              formatMoney(m.net, { sign: "always" }),
              formatMoney(m.closing),
            ])}
          />
        }
        footnote="Projeção = receitas e despesas já cadastradas (recorrências, parcelas, faturas, comissões) + complemento de comissões pelo cenário + despesas variáveis estimadas. Não é promessa: revise as premissas."
      />

      <Panel
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela da previsão mês a mês"
      >
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Mês</th>
              <th className="px-3 py-2.5 text-right font-medium">Receitas</th>
              <th className="px-3 py-2.5 text-right font-medium">Despesas</th>
              <th className="px-3 py-2.5 text-right font-medium">Resultado</th>
              <th className="px-4 py-2.5 text-right font-medium">Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month} className="border-b border-line last:border-0">
                <td className="px-4 py-2 first-letter:uppercase">{formatMonth(m.month)}</td>
                <td className="px-3 py-2 text-right">
                  <Tooltip
                    content={`Cadastrado ${formatMoney(m.scheduledIncome)}`}
                  >
                    <span className="cursor-help underline decoration-ink-3 decoration-dotted underline-offset-4">
                      <MoneyText value={m.income} variant="table" tone="positive" />
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 text-right">
                  <Tooltip
                    content={`Cadastrado ${formatMoney(m.scheduledExpense)}${Number(m.variableEstimate) > 0 ? ` + variáveis estimadas ${formatMoney(m.variableEstimate)}` : ""}${Number(m.commissionComplement) > 0 ? ` + comissões estimadas ${formatMoney(m.commissionComplement)}` : ""}`}
                  >
                    <span className="cursor-help underline decoration-ink-3 decoration-dotted underline-offset-4">
                      <MoneyText value={m.expense} variant="table" />
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 text-right">
                  <MoneyText
                    value={m.net}
                    variant="table"
                    sign="always"
                    tone={m.net.startsWith("-") ? "critical" : "default"}
                  />
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  <MoneyText
                    value={m.closing}
                    variant="table"
                    tone={m.negative ? "critical" : "default"}
                  />
                  {m.negative ? (
                    <span className="ml-2 text-xs font-medium text-critical">negativo</span>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-sunken/50 text-xs text-ink-3">
              <td className="px-4 py-2">Total no período</td>
              <td className="px-3 py-2 text-right">
                <MoneyText
                  value={toMoneyString(sumMoney(data.months.map((m) => m.income)))}
                  variant="table"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyText
                  value={toMoneyString(sumMoney(data.months.map((m) => m.expense)))}
                  variant="table"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyText
                  value={toMoneyString(sumMoney(data.months.map((m) => m.net)))}
                  variant="table"
                  sign="always"
                />
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
