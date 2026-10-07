"use client";

import { TableIcon, BarChart3Icon } from "lucide-react";
import * as React from "react";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";

interface ChartFrameProps {
  /** A pergunta que o gráfico responde (DS: nenhum gráfico decorativo). */
  question: string;
  /** A resposta em uma linha. */
  answer?: React.ReactNode;
  chart: React.ReactNode;
  /** Versão em tabela (acessibilidade e quem prefere números). */
  table: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
}

export function ChartFrame({
  question,
  answer,
  chart,
  table,
  footnote,
  className,
}: ChartFrameProps) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <Panel className={className}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="grid gap-0.5">
          <h2 className="title-section">{question}</h2>
          {answer ? <p className="text-[13px] leading-5 text-ink-2">{answer}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
        >
          {asTable ? <BarChart3Icon /> : <TableIcon />}
          {asTable ? "Ver gráfico" : "Ver como tabela"}
        </Button>
      </div>
      <div className="px-3 pt-3 pb-4 sm:px-5">{asTable ? table : chart}</div>
      {footnote ? (
        <p className="border-t border-line px-5 py-3 text-xs text-ink-3">{footnote}</p>
      ) : null}
    </Panel>
  );
}

/** Tabela simples para a alternativa textual dos gráficos. */
export function ChartTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Dados do gráfico em tabela"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-2 py-1.5 ${j > 0 ? "text-right nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
