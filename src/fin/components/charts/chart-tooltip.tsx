"use client";

import { formatMoney } from "@fin/lib/money";

interface Item {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
}

/** Tooltip no padrão do DS: superfície elevada, valores em tinta, cor só na marca da série. */
export function MoneyTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  labelFormatter?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grid min-w-36 gap-1 rounded-card border border-line bg-surface-raised px-3 py-2 text-xs shadow-float">
      <span className="font-medium text-ink">
        {labelFormatter ? labelFormatter(String(label)) : label}
      </span>
      {payload.map((p) => (
        <span
          key={String(p.dataKey)}
          className="flex items-center justify-between gap-4 text-ink-2"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </span>
          <span className="font-medium text-ink nums">{formatMoney(String(p.value ?? 0))}</span>
        </span>
      ))}
    </div>
  );
}
