import Link from "next/link";
import type * as React from "react";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";

interface KpiCardProps {
  label: string;
  value: string;
  tone?: "default" | "positive" | "critical";
  sign?: "auto" | "always";
  lines?: React.ReactNode;
  href?: string;
  linkLabel?: string;
}

/** Indicador: rótulo, valor e uma linha de contexto. Sem ícone decorativo (DS §7). */
export function KpiCard({
  label,
  value,
  tone = "default",
  sign = "auto",
  lines,
  href,
  linkLabel,
}: KpiCardProps) {
  return (
    <Panel className="grid content-start gap-1.5 p-5">
      <span className="text-[13px] text-ink-2">{label}</span>
      <MoneyText value={value} variant="kpi" tone={tone} sign={sign} />
      {lines ? <div className="grid gap-0.5 text-xs leading-5 text-ink-3">{lines}</div> : null}
      {href ? (
        <Link
          href={href}
          className="mt-1 w-fit text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          {linkLabel ?? "Ver detalhes"}
        </Link>
      ) : null}
    </Panel>
  );
}
