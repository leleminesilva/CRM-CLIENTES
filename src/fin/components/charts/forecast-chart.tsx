"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import { useIsClient } from "@fin/lib/use-client-store";
import { MoneyTooltip } from "./chart-tooltip";

export interface ForecastPoint {
  month: string;
  /** Linha do cenário escolhido. */
  closing: number;
  /** Faixa entre o conservador e o otimista: [min, max]. */
  band: [number, number];
}

/** Saldo projetado: linha do cenário escolhido sobre a faixa conservador–otimista. Abaixo de zero fica à vista. */
export function ForecastChart({ data, height = 280 }: { data: ForecastPoint[]; height?: number }) {
  const isClient = useIsClient();
  if (!isClient) return <div style={{ height }} aria-hidden />;
  return (
    <div
      style={{ height }}
      role="img"
      aria-label="Gráfico do saldo projetado nos próximos meses, com faixa entre o cenário conservador e o otimista"
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
          />
          <YAxis
            tickFormatter={(v: number) => formatMoney(String(v), { compact: true })}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <ReferenceLine y={0} stroke="var(--status-critical, #d03b3b)" strokeDasharray="4 4" />
          <Tooltip content={<MoneyTooltip labelFormatter={(m) => formatMonth(m)} />} />
          <Area
            dataKey="band"
            name="Faixa (conservador a otimista)"
            stroke="none"
            fill="var(--series-commission)"
            fillOpacity={0.16}
            isAnimationActive={false}
          />
          <Line
            dataKey="closing"
            name="Saldo projetado"
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
