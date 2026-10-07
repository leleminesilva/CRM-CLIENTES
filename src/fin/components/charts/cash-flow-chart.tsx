"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@fin/lib/money";
import { useIsClient } from "@fin/lib/use-client-store";
import { MoneyTooltip } from "./chart-tooltip";

export interface CashPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  closing: number;
  projected: boolean;
}

/** Entradas e saídas do período em barras e o saldo ao fim dele em linha (mesmo eixo, em R$). */
export function CashFlowChart({ data, height = 260 }: { data: CashPoint[]; height?: number }) {
  const isClient = useIsClient();
  if (!isClient) return <div style={{ height }} aria-hidden />;
  return (
    <div
      style={{ height }}
      role="img"
      aria-label="Gráfico de entradas, saídas e saldo ao fim de cada período"
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
            dataKey="label"
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={{ stroke: "var(--line-strong)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v: number) => formatMoney(String(v), { compact: true })}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip cursor={{ fill: "var(--surface-sunken)" }} content={<MoneyTooltip />} />
          <Bar
            dataKey="income"
            name="Entradas"
            fill="var(--series-income)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="expense"
            name="Saídas"
            fill="var(--series-expense)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Line
            dataKey="closing"
            name="Saldo final"
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
