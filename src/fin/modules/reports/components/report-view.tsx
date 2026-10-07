"use client";

import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { MonthlyBars } from "@fin/components/charts/monthly-bars";
import { ChartLegend } from "@fin/components/charts/income-expense-chart";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { cn } from "@fin/lib/cn";
import { formatMoney } from "@fin/lib/money";
import { displayCell, isNumericCell } from "../format";
import type { ReportCell, ReportResult } from "../types";

function Cell({ cell, bold }: { cell: ReportCell; bold?: boolean }) {
  if (cell && typeof cell === "object" && "money" in cell)
    return (
      <MoneyText
        value={cell.money}
        variant="table"
        className={cn(bold && "font-semibold")}
        tone={cell.money.startsWith("-") ? "critical" : "default"}
      />
    );
  return <span className={cn("nums", bold && "font-semibold")}>{displayCell(cell)}</span>;
}

export function ReportView({ report }: { report: ReportResult }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const exportHref = (format: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("formato", format);
    return `/api/fin/relatorios/${pathname.split("/").pop()}?${next}`;
  };
  const chart = report.chart;
  const max = chart?.kind === "bars" ? Math.max(...(chart.items ?? []).map((i) => i.value), 1) : 1;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {report.note ? <p className="text-[13px] text-ink-2">{report.note}</p> : <span />}
        <div className="flex gap-2" role="group" aria-label="Exportar relatório">
          <Button variant="secondary" size="sm" asChild>
            <a href={exportHref("csv")} download>
              <DownloadIcon /> CSV
            </a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={exportHref("xlsx")} download>
              <FileSpreadsheetIcon /> Excel
            </a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={exportHref("pdf")} download>
              <FileTextIcon /> PDF
            </a>
          </Button>
        </div>
      </div>

      {chart?.kind === "monthly" && chart.data && chart.series ? (
        <Panel className="grid gap-3 p-5">
          {chart.series.length > 1 ? (
            <ChartLegend items={chart.series.map((s) => ({ label: s.name, color: s.color }))} />
          ) : null}
          <MonthlyBars data={chart.data} series={chart.series} stacked={chart.stacked} />
        </Panel>
      ) : null}
      {chart?.kind === "bars" && chart.items?.length ? (
        <Panel className="p-5">
          <ul className="grid gap-2.5" aria-label="Gráfico de barras por categoria">
            {chart.items.map((i) => (
              <li key={i.label} className="grid gap-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{i.label}</span>
                  <span className="font-medium nums">{formatMoney(i.value.toFixed(2))}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden>
                  <div
                    className="h-full rounded-full bg-series-expense"
                    style={{ width: `${(i.value / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`Tabela: ${report.title}`}
      >
        {report.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-3">
            Nenhum dado para estes filtros.
          </p>
        ) : (
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                {report.head.map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className={cn("px-4 py-2.5 font-medium", i > 0 && "text-right")}
                  >
                    {h.length === 7 && /^\d{4}-\d{2}$/.test(h) ? displayCell(h) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-0">
                  {row.map((c, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-4 py-2",
                        isNumericCell(c) || i > 0 ? "text-right" : "first-letter:uppercase",
                      )}
                    >
                      <Cell cell={c} />
                    </td>
                  ))}
                </tr>
              ))}
              {report.totals ? (
                <tr className="bg-surface-sunken/60">
                  {report.totals.map((c, i) => (
                    <td key={i} className={cn("px-4 py-2.5", i > 0 && "text-right")}>
                      <Cell cell={c} bold />
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
