"use client";

import {
  Area,
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

export function NetWorthChart({
  data,
  height = 260,
}: {
  data: { month: string; netWorth: number; assets: number; liabilities: number }[];
  height?: number;
}) {
  const isClient = useIsClient();
  if (!isClient) return <div style={{ height }} aria-hidden />;
  return (
    <div
      style={{ height }}
      role="img"
      aria-label="Gráfico da evolução do patrimônio líquido, ativos e passivos"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
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
          <Tooltip content={<MoneyTooltip labelFormatter={(m) => formatMonth(m)} />} />
          <Area
            dataKey="netWorth"
            name="Patrimônio líquido"
            stroke="none"
            fill="var(--series-income)"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Line
            dataKey="assets"
            name="Ativos"
            stroke="var(--series-income)"
            strokeWidth={1.5}
            dot={false}
            type="monotone"
          />
          <Line
            dataKey="liabilities"
            name="Passivos"
            stroke="var(--series-expense)"
            strokeWidth={1.5}
            dot={false}
            type="monotone"
          />
          <Line
            dataKey="netWorth"
            name="Patrimônio líquido"
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
