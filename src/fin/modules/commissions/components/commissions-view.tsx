"use client";

import {
  BadgePercentIcon,
  BanIcon,
  CheckIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
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
import { deleteCommissionAction, setCommissionCanceledAction } from "../actions";
import type { CommissionDTO, CommissionStats } from "../queries";
import { CommissionFormDialog } from "./commission-form-dialog";

interface Props {
  commissions: CommissionDTO[];
  stats: CommissionStats;
  month: string;
  currentMonth: string;
  accounts: FormOptions["accounts"];
  today: ISODate;
}

export function CommissionsView({
  commissions,
  stats,
  month,
  currentMonth,
  accounts,
  today,
}: Props) {
  const [form, setForm] = React.useState<{ c?: CommissionDTO } | null>(null);
  const [receiving, setReceiving] = React.useState<CommissionDTO | null>(null);
  const [deleting, setDeleting] = React.useState<CommissionDTO | null>(null);

  const kpis = [
    { label: "Prevista no mês", value: stats.expected },
    { label: "Recebida", value: stats.received },
    { label: "A receber", value: stats.pending },
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
        description="Vendas, comissões previstas e recebidas. Cada comissão entra na renda do mês da previsão de pagamento."
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
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
          question="Como as comissões evoluíram em 12 meses?"
          answer={`Média de ${formatMoney(stats.average6)} por mês nos últimos 6 meses (${formatMoney(stats.average12)} em 12).`}
          chart={
            <MonthlyBars
              data={stats.byMonth.map((m) => ({ month: m.month, total: Number(m.total) }))}
              series={[{ key: "total", name: "Comissões", color: "var(--series-commission)" }]}
            />
          }
          table={
            <ChartTable
              head={["Mês", "Prevista", "Recebida"]}
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
            <h2 className="title-section">Quem mais gerou comissão?</h2>
            <p className="text-[13px] text-ink-2">Últimos 12 meses</p>
          </div>
          {stats.byClient.length === 0 ? (
            <p className="text-[13px] text-ink-3">Sem comissões no período.</p>
          ) : (
            <ul className="grid gap-2.5">
              {stats.byClient.map((c) => {
                const max = Number(stats.byClient[0]?.total ?? 1) || 1;
                return (
                  <li key={c.client} className="grid gap-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{c.client}</span>
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
        <h2 className="title-section">Comissões de {formatMonth(month)}</h2>
        <Panel className="overflow-hidden">
          {commissions.length === 0 ? (
            <EmptyState
              icon={BadgePercentIcon}
              title="Nenhuma comissão prevista para este mês"
              description="Registre a venda e o percentual: o sistema calcula a comissão e coloca a receita na data prevista."
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
                  className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 ${c.status === "CANCELED" ? "bg-surface-sunken/50" : ""}`}
                >
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-medium">{c.clientName}</span>
                    <span className="truncate text-[13px] text-ink-3">
                      {c.saleDescription} · venda de {formatMoney(c.saleAmount)} ×{" "}
                      {c.ratePercent.replace(".", ",")}% · previsão {formatDate(c.expectedDate)}
                    </span>
                  </div>
                  <div className="grid justify-items-end gap-0.5">
                    <MoneyText
                      value={c.amount}
                      variant="table"
                      sign="always"
                      tone="positive"
                      className="text-sm font-medium"
                    />
                    <StatusBadge type="INCOME" status={c.status} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ações de ${c.clientName}`}
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {c.status === "PENDING" || c.status === "OVERDUE" ? (
                        <DropdownMenuItem onSelect={() => setReceiving(c)}>
                          <CheckIcon /> Marcar como recebida
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
                              toast.success("Voltou para a receber");
                          }}
                        >
                          <RotateCcwIcon /> Voltar para a receber
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
          today={today}
        />
      ) : null}
      {receiving ? (
        <SettleDialog
          open
          onOpenChange={(o) => !o && setReceiving(null)}
          count={1}
          verb="recebida"
          needsAccount={!receiving.account}
          accounts={accounts}
          today={today}
          onConfirm={async (input) => {
            if (
              handleActionResult(
                await settleTransactionsAction({ ids: [receiving.transactionId], ...input }),
              )
            ) {
              toast.success("Comissão recebida");
              setReceiving(null);
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir a comissão de “${deleting?.clientName ?? ""}”?`}
        description={
          <p>
            A venda e a receita prevista serão removidas. Se a venda foi desfeita, prefira
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
