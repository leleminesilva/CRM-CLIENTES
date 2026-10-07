"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import { useIsClient } from "@fin/lib/use-client-store";
import { MoneyTooltip } from "./chart-tooltip";

export interface MonthlySeries {
  key: string;
  name: string;
  /** Token de cor do DS, ex.: "var(--series-expense)". */
  color: string;
}

interface MonthlyBarsProps {
  data: ({ month: string } & Record<string, number | string>)[];
  series: MonthlySeries[];
  height?: number;
  stacked?: boolean;
}

/** Barras mensais finas, pontas arredondadas, grade recessiva e um único eixo (DS + guia de dados). */
export function MonthlyBars({ data, series, height = 220, stacked = false }: MonthlyBarsProps) {
  const isClient = useIsClient();
  if (!isClient) return <div style={{ height }} aria-hidden />;
  return (
    <div
      style={{ height }}
      role="img"
      aria-label={`Gráfico de barras por mês: ${series.map((s) => s.name).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          barGap={2}
          barCategoryGap="28%"
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
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={stacked ? 0 : [4, 4, 0, 0]}
              stackId={stacked ? "a" : undefined}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
