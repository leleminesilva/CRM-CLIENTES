"use client";

import {
  BanIcon,
  CheckIcon,
  EllipsisIcon,
  FileCheckIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
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
import { SettleDialog } from "@fin/modules/transactions/components/settle-dialog";
import {
  setCanceledAction,
  settleTransactionsAction,
  unsettleTransactionsAction,
} from "@fin/modules/transactions/actions";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { deleteChequeAction, setChequeBouncedAction } from "../actions";
import type { ChequeDTO, ChequeStats } from "../queries";
import { ChequeFormDialog } from "./cheque-form-dialog";

type Filter = "ALL" | "ISSUED" | "RECEIVED";

function statusInfo(c: ChequeDTO): { label: string; tone: string } {
  if (c.bounced) return { label: "Devolvido", tone: "text-critical font-medium" };
  switch (c.status) {
    case "SETTLED":
      return { label: "Compensado", tone: "text-status-good" };
    case "OVERDUE":
      return { label: "Vencido", tone: "text-critical font-medium" };
    case "CANCELED":
      return { label: "Cancelado", tone: "text-ink-3 line-through" };
    default:
      return { label: "A compensar", tone: "text-ink-2" };
  }
}

interface Props {
  cheques: ChequeDTO[];
  stats: ChequeStats;
  month: string;
  currentMonth: string;
  accounts: FormOptions["accounts"];
  today: ISODate;
}

export function ChequesView({ cheques, stats, month, currentMonth, accounts, today }: Props) {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [form, setForm] = React.useState<{ c?: ChequeDTO } | null>(null);
  const [clearing, setClearing] = React.useState<ChequeDTO | null>(null);
  const [deleting, setDeleting] = React.useState<ChequeDTO | null>(null);

  const shown = cheques.filter((c) => filter === "ALL" || c.direction === filter);
  const kpis = [
    { label: "Emitidos a compensar", value: stats.issuedPending, note: "pagamos" },
    { label: "Recebidos a depositar", value: stats.receivedPending, note: "recebemos" },
    { label: "Compensados no mês", value: stats.cleared, note: `${stats.clearedCount} cheques` },
    {
      label: "Devolvidos (todos)",
      value: stats.bounced,
      critical: stats.bouncedCount > 0,
      note: stats.bouncedCount ? `${stats.bouncedCount} cheques` : "nenhum",
    },
  ];
  const tabs: { id: Filter; label: string }[] = [
    { id: "ALL", label: "Todos" },
    { id: "ISSUED", label: "Emitidos" },
    { id: "RECEIVED", label: "Recebidos" },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cheques"
        description="Cheques que a empresa emite e recebe. Cada cheque entra nas despesas ou receitas no dia do “bom para”."
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
            <Button onClick={() => setForm({})}>
              <PlusIcon /> Novo cheque
            </Button>
          </>
        }
      />

      <Panel className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {kpis.map((k) => (
          <div key={k.label} className="grid content-start gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">{k.label}</span>
            <MoneyText value={k.value} variant="kpi" tone={k.critical ? "critical" : "default"} />
            <span className="text-xs text-ink-3">{k.note}</span>
          </div>
        ))}
      </Panel>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="title-section">Cheques de {formatMonth(month)}</h2>
          <div className="inline-flex rounded-control border border-line bg-surface p-0.5" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={filter === t.id}
                onClick={() => setFilter(t.id)}
                className={`rounded-[6px] px-3 py-1 text-[13px] transition-colors ${
                  filter === t.id ? "bg-ink text-on-ink" : "text-ink-2 hover:bg-surface-sunken"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Panel className="overflow-hidden">
          {shown.length === 0 ? (
            <EmptyState
              icon={FileCheckIcon}
              title="Nenhum cheque neste mês"
              description="Registre os cheques emitidos e os recebidos. Eles aparecem aqui pelo “bom para”."
              action={
                <Button onClick={() => setForm({})}>
                  <PlusIcon /> Novo cheque
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((c) => {
                const s = statusInfo(c);
                const issued = c.direction === "ISSUED";
                return (
                  <li
                    key={c.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3"
                  >
                    <div className="grid min-w-0 gap-0.5">
                      <span className="truncate text-sm font-medium">
                        Cheque {c.number} · {c.party}
                      </span>
                      <span className="truncate text-[13px] text-ink-3">
                        {issued ? "Emitido" : "Recebido"}
                        {c.bank ? ` · ${c.bank}` : ""} · emissão {formatDate(c.issueDate)} · bom para{" "}
                        {formatDate(c.dueDate)}
                        {c.account ? ` · ${c.account.name}` : ""}
                      </span>
                    </div>
                    <div className="grid justify-items-end gap-0.5">
                      <MoneyText
                        value={c.amount}
                        variant="table"
                        sign="never"
                        tone={issued ? "default" : "positive"}
                        className="text-sm font-medium"
                      />
                      <span className={`text-xs ${s.tone}`}>{s.label}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações do cheque ${c.number}`}>
                          <EllipsisIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!c.bounced && (c.status === "PENDING" || c.status === "OVERDUE") ? (
                          <DropdownMenuItem onSelect={() => setClearing(c)}>
                            <CheckIcon /> Marcar como compensado
                          </DropdownMenuItem>
                        ) : null}
                        {c.status === "SETTLED" && !c.bounced ? (
                          <DropdownMenuItem
                            onSelect={async () => {
                              if (handleActionResult(await unsettleTransactionsAction({ ids: [c.transactionId] })))
                                toast.success("Voltou para a compensar");
                            }}
                          >
                            <RotateCcwIcon /> Voltar para a compensar
                          </DropdownMenuItem>
                        ) : null}
                        {!c.bounced && c.status !== "CANCELED" ? (
                          <DropdownMenuItem
                            onSelect={async () => {
                              if (handleActionResult(await setChequeBouncedAction({ id: c.id, bounced: true })))
                                toast.success("Cheque marcado como devolvido");
                            }}
                          >
                            <Undo2Icon /> Marcar como devolvido
                          </DropdownMenuItem>
                        ) : null}
                        {c.bounced ? (
                          <DropdownMenuItem
                            onSelect={async () => {
                              if (handleActionResult(await setChequeBouncedAction({ id: c.id, bounced: false })))
                                toast.success("Cheque voltou para a compensar");
                            }}
                          >
                            <RotateCcwIcon /> Desfazer devolução
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onSelect={() => setForm({ c })}>
                          <PencilIcon /> Editar
                        </DropdownMenuItem>
                        {!c.bounced && c.status !== "SETTLED" ? (
                          <DropdownMenuItem
                            onSelect={async () => {
                              const canceled = c.status !== "CANCELED";
                              if (handleActionResult(await setCanceledAction({ ids: [c.transactionId], canceled })))
                                toast.success(canceled ? "Cheque cancelado" : "Cheque reativado");
                            }}
                          >
                            {c.status === "CANCELED" ? <RotateCcwIcon /> : <BanIcon />}{" "}
                            {c.status === "CANCELED" ? "Reativar" : "Cancelar cheque"}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                          <Trash2Icon /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      {form ? (
        <ChequeFormDialog
          open
          onOpenChange={(o) => !o && setForm(null)}
          cheque={form.c}
          accounts={accounts}
          today={today}
          defaultDirection={filter === "RECEIVED" ? "RECEIVED" : "ISSUED"}
        />
      ) : null}
      {clearing ? (
        <SettleDialog
          open
          onOpenChange={(o) => !o && setClearing(null)}
          count={1}
          verb="compensado"
          needsAccount={!clearing.account}
          accounts={accounts}
          today={today}
          onConfirm={async (input) => {
            if (handleActionResult(await settleTransactionsAction({ ids: [clearing.transactionId], ...input }))) {
              toast.success("Cheque compensado");
              setClearing(null);
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir o cheque ${deleting?.number ?? ""}?`}
        description={
          <p>
            O cheque e o lançamento ligado a ele serão removidos. Se ele foi devolvido ou cancelado,
            prefira marcar assim para manter o histórico.
          </p>
        }
        confirmLabel="Excluir cheque"
        onConfirm={async () => {
          if (deleting && handleActionResult(await deleteChequeAction({ id: deleting.id })))
            toast.success("Cheque excluído");
        }}
      />
    </div>
  );
}
