"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanIcon,
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  PaperclipIcon,
  PencilIcon,
  RepeatIcon,
  RotateCcwIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { MoneyText } from "@fin/components/shared/money-text";
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
import { Tooltip } from "@fin/components/ui/tooltip";
import { cn } from "@fin/lib/cn";
import { formatDayMonth } from "@fin/lib/dates";
import { settleActionLabel } from "../domain/status";
import type { TransactionDTO } from "../types";
import type { useTransactionActions } from "./use-transaction-actions";

type Actions = ReturnType<typeof useTransactionActions>;

/** Valor com sinal: entradas positivas (verde), saídas negativas (tinta), transferências neutras. */
export function SignedAmount({ t, className }: { t: TransactionDTO; className?: string }) {
  if (t.type === "INCOME" || t.type === "REFUND")
    return (
      <MoneyText
        value={t.amount}
        sign="always"
        tone="positive"
        variant="table"
        className={className}
      />
    );
  if (t.type === "TRANSFER")
    return (
      <MoneyText value={t.amount} sign="never" variant="table" tone="muted" className={className} />
    );
  return <MoneyText value={`-${t.amount}`} variant="table" className={className} />;
}

function titleLine(t: TransactionDTO) {
  if (t.type === "TRANSFER") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-3">
        <span className="truncate">{t.account?.name ?? "—"}</span>
        <ArrowRightIcon className="size-3 shrink-0" />
        <span className="truncate">{t.transferAccount?.name ?? "—"}</span>
      </span>
    );
  }
  const parts = [
    t.category
      ? t.category.parentName
        ? `${t.category.parentName} › ${t.category.name}`
        : t.category.name
      : null,
    t.account?.name ?? t.creditCard?.name ?? null,
  ].filter(Boolean);
  return (
    <span className="truncate text-[13px] text-ink-3">
      {parts.join(" · ") || "Sem conta definida"}
    </span>
  );
}

interface TransactionRowProps {
  t: TransactionDTO;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  actions: Actions;
  selectable: boolean;
}

export function TransactionRow({
  t,
  selected,
  onSelectedChange,
  actions,
  selectable,
}: TransactionRowProps) {
  const canEdit =
    t.editable &&
    t.type !== "REFUND" &&
    t.type !== "CARD_PAYMENT" &&
    !t.installment &&
    !t.commissionId;
  // Compras no cartão são pagas junto com a fatura; parcelas são geridas pelo parcelamento.
  const onCard = Boolean(t.creditCard);
  const managed = Boolean(t.installment) || Boolean(t.commissionId);
  const pending = t.status === "PENDING";
  const settled = t.status === "SETTLED";
  const canceled = t.status === "CANCELED";

  return (
    <div
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4 md:grid-cols-[auto_3.25rem_minmax(0,1fr)_9rem_8rem_7rem_auto]",
        selected && "bg-surface-sunken",
        canceled && "bg-surface-sunken/50",
      )}
    >
      {selectable ? (
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelectedChange(v === true)}
          aria-label={`Selecionar ${t.description}`}
          className="row-span-2 md:row-span-1"
        />
      ) : (
        <span className="w-4" />
      )}

      <span className="text-[13px] text-ink-3 nums max-md:hidden">{formatDayMonth(t.dueDate)}</span>

      <div className="flex min-w-0 items-center gap-2.5">
        {t.category ? (
          <CategoryIconChip icon={t.category.icon} color={t.category.color} />
        ) : (
          <span
            className="size-7 shrink-0 rounded-[7px] border border-dashed border-line-strong"
            aria-hidden
          />
        )}
        <div className="grid min-w-0 gap-0.5">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-sm font-medium",
              canceled && "line-through",
            )}
          >
            <button
              type="button"
              onClick={() => canEdit && actions.edit(t)}
              disabled={!canEdit}
              className="min-w-0 cursor-pointer truncate text-left hover:underline disabled:cursor-default disabled:no-underline"
            >
              {t.description}
            </button>
            {t.installment ? (
              <span className="shrink-0 rounded-full bg-surface-sunken px-1.5 text-[11px] font-normal text-ink-2 nums">
                {t.installment.number}/{t.installment.count}
              </span>
            ) : null}
            {t.recurrenceId ? (
              <Tooltip content="Lançamento recorrente">
                <RepeatIcon
                  className="size-3.5 shrink-0 text-ink-3"
                  role="img"
                  aria-label="Recorrente"
                />
              </Tooltip>
            ) : null}
            {t.attachmentCount > 0 ? (
              <Tooltip content={`${t.attachmentCount} anexo${t.attachmentCount > 1 ? "s" : ""}`}>
                <PaperclipIcon
                  className="size-3.5 shrink-0 text-ink-3"
                  role="img"
                  aria-label={`${t.attachmentCount} anexos`}
                />
              </Tooltip>
            ) : null}
            {t.isBalanceAdjustment ? (
              <span className="shrink-0 rounded-full border border-line-strong px-1.5 text-[11px] font-normal text-ink-2">
                ajuste
              </span>
            ) : null}
          </span>
          {titleLine(t)}
        </div>
      </div>

      <span className="truncate text-[13px] text-ink-2 max-md:hidden">
        {t.account?.name ?? t.creditCard?.name ?? "—"}
      </span>

      <div className="row-span-2 grid content-center justify-items-end gap-0.5 md:row-span-1 md:contents">
        <span className="text-[15px] font-medium md:text-right md:text-sm">
          <SignedAmount t={t} />
        </span>
        <span className="md:justify-self-start">
          <StatusBadge type={t.type} status={t.displayStatus} />
        </span>
      </div>

      <div className="row-span-2 self-center md:row-span-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${t.description}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {pending && t.editable && !onCard ? (
              <DropdownMenuItem onSelect={() => actions.requestSettle([t])}>
                <CheckIcon /> {settleActionLabel(t.type)}
              </DropdownMenuItem>
            ) : null}
            {settled && t.editable && !onCard ? (
              <DropdownMenuItem onSelect={() => void actions.unsettle([t])}>
                <Undo2Icon /> Voltar para pendente
              </DropdownMenuItem>
            ) : null}
            {canEdit ? (
              <DropdownMenuItem onSelect={() => actions.edit(t)}>
                <PencilIcon /> Editar
              </DropdownMenuItem>
            ) : null}
            {t.editable && t.type !== "REFUND" && !managed ? (
              <DropdownMenuItem onSelect={() => actions.duplicate(t)}>
                <CopyIcon /> Duplicar
              </DropdownMenuItem>
            ) : null}
            {t.editable && !settled && !managed ? (
              canceled ? (
                <DropdownMenuItem onSelect={() => void actions.setCanceled([t], false)}>
                  <RotateCcwIcon /> Reativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void actions.setCanceled([t], true)}>
                  <BanIcon /> Cancelar lançamento
                </DropdownMenuItem>
              )
            ) : null}
            {onCard && t.type === "EXPENSE" && !settled ? (
              <>
                <DropdownMenuItem onSelect={() => void actions.moveInvoice(t, -1)}>
                  <ArrowLeftIcon /> Mover para a fatura anterior
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void actions.moveInvoice(t, 1)}>
                  <ArrowRightIcon /> Mover para a próxima fatura
                </DropdownMenuItem>
              </>
            ) : null}
            {t.editable && !managed ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => void actions.requestDelete([t])}>
                  <Trash2Icon /> Excluir
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
