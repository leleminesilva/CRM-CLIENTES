"use client";

import { CheckIcon, ReceiptIcon, Trash2Icon, XIcon } from "lucide-react";
import * as React from "react";
import { EmptyState } from "@fin/components/shared/empty-state";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { Checkbox } from "@fin/components/ui/checkbox";
import { formatRelativeDay, formatWeekdayDate, type ISODate } from "@fin/lib/dates";
import type { FormOptions } from "../form-options";
import type { TransactionDTO } from "../types";
import { TransactionRow } from "./transaction-row";
import { useTransactionActions } from "./use-transaction-actions";
import { useTransactionForm } from "./transaction-form-provider";

interface TransactionListProps {
  transactions: TransactionDTO[];
  today: ISODate;
  accounts: FormOptions["accounts"];
  emptyTitle?: string;
  emptyDescription?: string;
  /** Tipo a pré-selecionar no botão "Novo" do estado vazio. */
  emptyType?: "INCOME" | "EXPENSE";
  /** Agrupa por dia de vencimento. */
  grouped?: boolean;
}

export function TransactionList({
  transactions,
  today,
  accounts,
  emptyTitle = "Nenhum lançamento neste período",
  emptyDescription = "Registre uma receita ou despesa. Leva poucos segundos: valor, descrição, categoria e conta.",
  emptyType,
  grouped = true,
}: TransactionListProps) {
  const actions = useTransactionActions({ today, accounts });
  const { openCreate } = useTransactionForm();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Seleção só vale para itens ainda presentes na lista atual.
  const visibleSelected = React.useMemo(
    () => new Set([...selected].filter((id) => transactions.some((t) => t.id === id))),
    [selected, transactions],
  );
  const chosen = transactions.filter((t) => visibleSelected.has(t.id));
  const selectable = transactions.filter(
    (t) => t.editable && t.type !== "CARD_PAYMENT" && !t.installment,
  );

  function toggle(id: string, on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (transactions.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={ReceiptIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button onClick={() => openCreate(emptyType ? { type: emptyType } : undefined)}>
              Novo lançamento
            </Button>
          }
        />
        {actions.dialogs}
      </Panel>
    );
  }

  const groups: { date: ISODate; items: TransactionDTO[] }[] = [];
  if (grouped) {
    for (const t of transactions) {
      const last = groups.at(-1);
      if (last?.date === t.dueDate) last.items.push(t);
      else groups.push({ date: t.dueDate, items: [t] });
    }
  } else {
    groups.push({ date: today, items: transactions });
  }

  const allSelected = selectable.length > 0 && selectable.every((t) => visibleSelected.has(t.id));
  const pendingChosen = chosen.filter((t) => t.status === "PENDING");

  return (
    <div className="grid gap-3">
      <div className="flex min-h-9 items-center gap-3 px-1">
        {selectable.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <Checkbox
              checked={allSelected ? true : visibleSelected.size > 0 ? "indeterminate" : false}
              onCheckedChange={(v) =>
                setSelected(v === true ? new Set(selectable.map((t) => t.id)) : new Set())
              }
              aria-label="Selecionar todos"
            />
            {visibleSelected.size > 0
              ? `${visibleSelected.size} selecionado${visibleSelected.size > 1 ? "s" : ""}`
              : "Selecionar"}
          </label>
        ) : null}
        {chosen.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {pendingChosen.length > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => actions.requestSettle(pendingChosen)}
              >
                <CheckIcon /> Marcar como concluído
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void actions.requestDelete(chosen);
                setSelected(new Set());
              }}
            >
              <Trash2Icon /> Excluir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <XIcon /> Limpar
            </Button>
          </div>
        ) : null}
        <span className="ml-auto text-[13px] text-ink-3 nums">
          {transactions.length} {transactions.length === 1 ? "lançamento" : "lançamentos"}
        </span>
      </div>

      <Panel className="overflow-hidden">
        {groups.map((g) => (
          <section key={g.date} aria-label={grouped ? formatWeekdayDate(g.date) : undefined}>
            {grouped ? (
              <h3 className="flex items-baseline gap-2 border-b border-line bg-surface-sunken/60 px-4 py-1.5 text-xs font-medium text-ink-2">
                <span className="nums">{formatWeekdayDate(g.date)}</span>
                {g.date === today ||
                formatRelativeDay(g.date, today).startsWith("em") ||
                formatRelativeDay(g.date, today).startsWith("há") ||
                ["amanhã", "ontem"].includes(formatRelativeDay(g.date, today)) ? (
                  <span className="font-normal text-ink-3">{formatRelativeDay(g.date, today)}</span>
                ) : null}
              </h3>
            ) : null}
            <div className="divide-y divide-line">
              {g.items.map((t) => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  actions={actions}
                  selectable={selectable.includes(t)}
                  selected={visibleSelected.has(t.id)}
                  onSelectedChange={(on) => toggle(t.id, on)}
                />
              ))}
            </div>
          </section>
        ))}
      </Panel>
      {actions.dialogs}
    </div>
  );
}
