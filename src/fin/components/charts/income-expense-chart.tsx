"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import { useIsClient } from "@fin/lib/use-client-store";
import { MoneyTooltip } from "./chart-tooltip";

/** Receitas (aqua) × despesas (laranja) por mês, com o resultado como linha em tinta (DS §2.2). */
export function IncomeExpenseChart({
  data,
  height = 240,
}: {
  data: { month: string; income: number; expense: number; result: number }[];
  height?: number;
}) {
  const isClient = useIsClient();
  if (!isClient) return <div style={{ height }} aria-hidden />;
  return (
    <div
      style={{ height }}
      role="img"
      aria-label="Gráfico de receitas, despesas e resultado por mês"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          barGap={2}
          barCategoryGap="24%"
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => formatMonth(m, "short")}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={{ stroke: "var(--line-strong)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => formatMoney(String(v), { compact: true })}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-sunken)" }}
            content={<MoneyTooltip labelFormatter={(m) => formatMonth(m)} />}
          />
          <Bar
            dataKey="income"
            name="Receitas"
            fill="var(--series-income)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="expense"
            name="Despesas"
            fill="var(--series-expense)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Line
            dataKey="result"
            name="Resultado"
            stroke="var(--ink)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 }}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; line?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.line ? (
            <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: i.color }} />
          ) : (
            <span
              className="inline-block size-2.5 rounded-[3px]"
              style={{ backgroundColor: i.color }}
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
