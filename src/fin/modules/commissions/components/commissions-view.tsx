"use client";

import {
  BadgePercentIcon,
  BanIcon,
  CheckIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ChartFrame, ChartTable } from "@fin/components/charts/chart-frame";
import { MonthlyBars } from "@fin/components/charts/monthly-bars";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { StatusBadge } from "@fin/components/shared/status-badge";
import { Button } from "@fin/components/ui/button";
import { Checkbox } from "@fin/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate, formatMonth, type ISODate } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { SettleDialog } from "@fin/modules/transactions/components/settle-dialog";
import {
  settleTransactionsAction,
  unsettleTransactionsAction,
} from "@fin/modules/transactions/actions";
import {
  deleteCommissionAction,
  setCommissionCanceledAction,
  setCommissionWorkAction,
} from "../actions";
import type { CommissionDTO, CommissionStats } from "../queries";
import { CommissionFormDialog } from "./commission-form-dialog";
import { CommissionImportDialog } from "./commission-import-dialog";

interface Props {
  commissions: CommissionDTO[];
  stats: CommissionStats;
  month: string;
  currentMonth: string;
  accounts: FormOptions["accounts"];
  sellers: string[];
  today: ISODate;
}

export function CommissionsView({
  commissions,
  stats,
  month,
  currentMonth,
  accounts,
  sellers,
  today,
}: Props) {
  const [form, setForm] = React.useState<{ c?: CommissionDTO } | null>(null);
  const [importing, setImporting] = React.useState(false);
  // Marcações de medidas/projeto aparecem na hora; o servidor confirma em seguida.
  const [work, setWork] = React.useState<Record<string, { m?: boolean; p?: boolean }>>({});
  const isMeasured = (c: CommissionDTO) => work[c.id]?.m ?? c.didMeasurements;
  const isProjected = (c: CommissionDTO) => work[c.id]?.p ?? c.didProject;
  async function toggleWork(c: CommissionDTO, field: "m" | "p", value: boolean) {
    setWork((w) => ({ ...w, [c.id]: { ...w[c.id], [field]: value } }));
    const result = await setCommissionWorkAction({
      id: c.id,
      ...(field === "m" ? { didMeasurements: value } : { didProject: value }),
    });
    if (!handleActionResult(result))
      setWork((w) => ({ ...w, [c.id]: { ...w[c.id], [field]: !value } }));
  }
  const measuredCount = commissions.filter((c) => c.status !== "CANCELED" && isMeasured(c)).length;
  const projectedCount = commissions.filter((c) => c.status !== "CANCELED" && isProjected(c)).length;
  const [receiving, setReceiving] = React.useState<CommissionDTO | null>(null);
  const [deleting, setDeleting] = React.useState<CommissionDTO | null>(null);

  const kpis = [
    { label: "Prevista no mês", value: stats.expected },
    { label: "Paga", value: stats.received },
    { label: "A pagar", value: stats.pending },
    {
      label: "Atrasada (todas)",
      value: stats.overdue,
      critical: stats.overdueCount > 0,
      note: stats.overdueCount
        ? `${stats.overdueCount} ${stats.overdueCount === 1 ? "comissão" : "comissões"}`
        : "nenhuma",
    },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Comissões"
        description="Comissões que a empresa paga aos vendedores. Cada comissão entra nas despesas do mês da previsão de pagamento."
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <UploadIcon /> Importar CSV
            </Button>
            <Button onClick={() => setForm({})}>
              <PlusIcon /> Nova comissão
            </Button>
          </>
        }
      />
      <Panel className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {kpis.map((k) => (
          <div key={k.label} className="grid content-start gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">{k.label}</span>
            <MoneyText value={k.value} variant="kpi" tone={k.critical ? "critical" : "default"} />
            {k.note ? <span className="text-xs text-ink-3">{k.note}</span> : null}
          </div>
        ))}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ChartFrame
          question="Quanto pagamos de comissão em 12 meses?"
          answer={`Média de ${formatMoney(stats.average6)} por mês nos últimos 6 meses (${formatMoney(stats.average12)} em 12).`}
          chart={
            <MonthlyBars
              data={stats.byMonth.map((m) => ({ month: m.month, total: Number(m.total) }))}
              series={[{ key: "total", name: "Comissões", color: "var(--series-commission)" }]}
            />
          }
          table={
            <ChartTable
              head={["Mês", "Prevista", "Paga"]}
              rows={stats.byMonth.map((m) => [
                formatMonth(m.month),
                formatMoney(m.total),
                formatMoney(m.received),
              ])}
            />
          }
          footnote="Pelo mês da previsão de pagamento; canceladas ficam de fora."
        />
        <Panel className="grid content-start gap-3 p-5">
          <div className="grid gap-0.5">
            <h2 className="title-section">Quem mais recebeu comissão?</h2>
            <p className="text-[13px] text-ink-2">Últimos 12 meses</p>
          </div>
          {stats.bySeller.length === 0 ? (
            <p className="text-[13px] text-ink-3">Sem comissões no período.</p>
          ) : (
            <ul className="grid gap-2.5">
              {stats.bySeller.map((c) => {
                const max = Number(stats.bySeller[0]?.total ?? 1) || 1;
                return (
                  <li key={c.seller} className="grid gap-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{c.seller}</span>
                      <MoneyText value={c.total} variant="table" className="font-medium" />
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-series-commission"
                        style={{ width: `${(Number(c.total) / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="title-section">Comissões de {formatMonth(month)}</h2>
          {commissions.length > 0 ? (
            <span className="text-[13px] text-ink-2">
              Medidas feitas em {measuredCount} · Projeto feito em {projectedCount}
            </span>
          ) : null}
        </div>
        <Panel className="overflow-hidden">
          {commissions.length === 0 ? (
            <EmptyState
              icon={BadgePercentIcon}
              title="Nenhuma comissão a pagar neste mês"
              description="Informe o vendedor, a venda e o percentual: o sistema calcula a comissão e lança a despesa na data prevista."
              action={
                <Button onClick={() => setForm({})}>
                  <PlusIcon /> Nova comissão
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {commissions.map((c) => (
                <li
                  key={c.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-4 py-3 ${c.status === "CANCELED" ? "bg-surface-sunken/50" : ""}`}
                >
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {c.sellerName || "Sem vendedor"}
                    </span>
                    <span className="truncate text-[13px] text-ink-3">
                      {c.clientName} · {c.saleDescription}
                      {Number(c.saleAmount) === Number(c.amount) && Number(c.ratePercent) === 100
                        ? ""
                        : ` · venda de ${formatMoney(c.saleAmount)} × ${c.ratePercent.replace(".", ",")}%`}
                      {` · previsão ${formatDate(c.expectedDate)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] text-ink-2">
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <Checkbox
                        checked={isMeasured(c)}
                        onCheckedChange={(v) => void toggleWork(c, "m", v === true)}
                        aria-label={`Medidas feitas — ${c.sellerName || c.clientName}`}
                      />
                      Medidas
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <Checkbox
                        checked={isProjected(c)}
                        onCheckedChange={(v) => void toggleWork(c, "p", v === true)}
                        aria-label={`Projeto feito — ${c.sellerName || c.clientName}`}
                      />
                      Projeto
                    </label>
                  </div>
                  <div className="grid justify-items-end gap-0.5">
                    <MoneyText
                      value={c.amount}
                      variant="table"
                      sign="never"
                      className="text-sm font-medium"
                    />
                    <StatusBadge type="EXPENSE" status={c.status} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ações da comissão de ${c.sellerName || c.clientName}`}
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {c.status === "PENDING" || c.status === "OVERDUE" ? (
                        <DropdownMenuItem onSelect={() => setReceiving(c)}>
                          <CheckIcon /> Marcar como paga
                        </DropdownMenuItem>
                      ) : null}
                      {c.status === "SETTLED" ? (
                        <DropdownMenuItem
                          onSelect={async () => {
                            if (
                              handleActionResult(
                                await unsettleTransactionsAction({ ids: [c.transactionId] }),
                              )
                            )
                              toast.success("Voltou para a pagar");
                          }}
                        >
                          <RotateCcwIcon /> Voltar para a pagar
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => setForm({ c })}>
                        <PencilIcon /> Editar
                      </DropdownMenuItem>
                      {c.status !== "SETTLED" ? (
                        <DropdownMenuItem
                          onSelect={async () => {
                            const canceled = c.status !== "CANCELED";
                            if (
                              handleActionResult(
                                await setCommissionCanceledAction({ id: c.id, canceled }),
                              )
                            )
                              toast.success(canceled ? "Comissão cancelada" : "Comissão reativada");
                          }}
                        >
                          {c.status === "CANCELED" ? <RotateCcwIcon /> : <BanIcon />}{" "}
                          {c.status === "CANCELED" ? "Reativar" : "Cancelar (venda desfeita)"}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                        <Trash2Icon /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {form ? (
        <CommissionFormDialog
          open
          onOpenChange={(o) => !o && setForm(null)}
          commission={form.c}
          accounts={accounts}
          sellers={sellers}
          today={today}
        />
      ) : null}
      {importing ? (
        <CommissionImportDialog open onOpenChange={(o) => !o && setImporting(false)} today={today} />
      ) : null}
      {receiving ? (
        <SettleDialog
          open
          onOpenChange={(o) => !o && setReceiving(null)}
          count={1}
          verb="paga"
          needsAccount={!receiving.account}
          accounts={accounts}
          today={today}
          onConfirm={async (input) => {
            if (
              handleActionResult(
                await settleTransactionsAction({ ids: [receiving.transactionId], ...input }),
              )
            ) {
              toast.success("Comissão paga");
              setReceiving(null);
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir a comissão de “${deleting?.sellerName || deleting?.clientName || ""}”?`}
        description={
          <p>
            A venda e a despesa prevista serão removidas. Se a venda foi desfeita, prefira
            “Cancelar” para manter o histórico.
          </p>
        }
        confirmLabel="Excluir comissão"
        onConfirm={async () => {
          if (deleting && handleActionResult(await deleteCommissionAction({ id: deleting.id })))
            toast.success("Comissão excluída");
        }}
      />
    </div>
  );
}
