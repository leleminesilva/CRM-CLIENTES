"use client";

import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { handleActionResult } from "@fin/lib/action-result";
import { addMonthsToKey, formatMonth, type ISODate, monthKeyOf } from "@fin/lib/dates";
import { moveToInvoiceAction } from "@fin/modules/credit-cards/actions";
import { formatMoney } from "@fin/lib/money";
import {
  deleteTransactionsAction,
  restoreTransactionsAction,
  setCanceledAction,
  settleTransactionsAction,
  unsettleTransactionsAction,
} from "../actions";
import { directionOf } from "../domain/status";
import type { FormOptions } from "../form-options";
import type { TransactionDTO } from "../types";
import { SettleDialog } from "./settle-dialog";
import { useScopeDialog } from "./scope-dialog";
import { useTransactionForm } from "./transaction-form-provider";

const SETTLED_VERB = { in: "recebido", out: "pago", move: "realizada" } as const;

/** Ações sobre lançamentos (pagar, desfazer, cancelar, excluir, editar, duplicar) com seus diálogos. */
export function useTransactionActions({
  today,
  accounts,
}: {
  today: ISODate;
  accounts: FormOptions["accounts"];
}) {
  const form = useTransactionForm();
  const scope = useScopeDialog();
  const [settling, setSettling] = React.useState<TransactionDTO[] | null>(null);
  const [deleting, setDeleting] = React.useState<TransactionDTO[] | null>(null);

  const verbFor = (items: TransactionDTO[]) => {
    const dirs = new Set(items.map((t) => directionOf(t.type)));
    return dirs.size === 1 ? SETTLED_VERB[[...dirs][0]!] : "concluído";
  };

  async function settle(
    items: TransactionDTO[],
    input: { settledAt: ISODate; accountId: string | null },
  ) {
    const result = await settleTransactionsAction({ ids: items.map((t) => t.id), ...input });
    if (!handleActionResult(result)) return false;
    const n = result?.data?.count ?? items.length;
    toast.success(
      n === 1
        ? `Marcado como ${verbFor(items)}`
        : `${n} lançamentos marcados como ${verbFor(items)}`,
      {
        duration: 8000,
        action: { label: "Desfazer", onClick: () => void unsettle(items, true) },
      },
    );
    return true;
  }

  /** Atalho: se todos já têm conta, marca na hora (hoje); senão, abre o diálogo. */
  function requestSettle(items: TransactionDTO[]) {
    const pending = items.filter((t) => t.status === "PENDING" && t.editable);
    if (pending.length === 0) return;
    const needsAccount = pending.some((t) => !t.account && !t.creditCard);
    if (needsAccount) setSettling(pending);
    else void settle(pending, { settledAt: today, accountId: null });
  }

  async function unsettle(items: TransactionDTO[], silent = false) {
    const result = await unsettleTransactionsAction({ ids: items.map((t) => t.id) });
    if (handleActionResult(result) && !silent) toast.success("Voltou para pendente");
    else if (silent) toast.success("Ação desfeita");
  }

  async function setCanceled(items: TransactionDTO[], canceled: boolean) {
    const result = await setCanceledAction({ ids: items.map((t) => t.id), canceled });
    if (handleActionResult(result))
      toast.success(canceled ? "Lançamento cancelado" : "Lançamento reativado");
  }

  async function requestDelete(items: TransactionDTO[]) {
    const recurring = items.length === 1 && items[0]?.recurrenceId;
    if (recurring) {
      const chosen = await scope.ask(
        "Excluir",
        ["this", "future"],
        "Excluir lançamento recorrente",
      );
      if (!chosen) return;
      await remove(items, chosen === "future" ? "future" : "this");
    } else {
      setDeleting(items);
    }
  }

  async function remove(items: TransactionDTO[], scopeChoice: "this" | "future") {
    const ids = items.map((t) => t.id);
    const result = await deleteTransactionsAction({ ids, scope: scopeChoice });
    if (!handleActionResult(result)) return;
    toast.success(
      items.length === 1
        ? "Lançamento enviado para a lixeira"
        : `${items.length} lançamentos enviados para a lixeira`,
      {
        duration: 8000,
        ...(scopeChoice === "this"
          ? {
              action: {
                label: "Desfazer",
                onClick: () => {
                  void restoreTransactionsAction({ ids }).then(
                    (r) => handleActionResult(r) && toast.success("Lançamento restaurado"),
                  );
                },
              },
            }
          : { description: "A série foi encerrada a partir desta data." }),
      },
    );
  }

  async function moveInvoice(t: TransactionDTO, delta: number) {
    const target = addMonthsToKey(monthKeyOf(t.dueDate), delta);
    const result = await moveToInvoiceAction({ transactionId: t.id, referenceMonth: target });
    if (handleActionResult(result)) toast.success(`Movida para a fatura de ${formatMonth(target)}`);
  }

  const dialogs = (
    <>
      {scope.dialog}
      {settling ? (
        <SettleDialog
          open
          onOpenChange={(open) => !open && setSettling(null)}
          count={settling.length}
          verb={verbFor(settling)}
          needsAccount={settling.some((t) => !t.account && !t.creditCard)}
          accounts={accounts}
          today={today}
          onConfirm={async (input) => {
            if (await settle(settling, input)) setSettling(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={
          deleting && deleting.length > 1
            ? `Excluir ${deleting.length} lançamentos?`
            : `Excluir “${deleting?.[0]?.description ?? ""}”?`
        }
        description={
          <p>
            {deleting?.length === 1 && deleting[0] ? `${formatMoney(deleting[0].amount)} · ` : ""}
            Ficam na lixeira por 30 dias e podem ser restaurados em Configurações.
          </p>
        }
        confirmLabel={
          deleting && deleting.length > 1
            ? `Excluir ${deleting.length} lançamentos`
            : "Excluir lançamento"
        }
        onConfirm={async () => {
          if (deleting) await remove(deleting, "this");
        }}
      />
    </>
  );

  return {
    dialogs,
    edit: form.openEdit,
    duplicate: form.openDuplicate,
    requestSettle,
    unsettle: (items: TransactionDTO[]) => unsettle(items),
    setCanceled,
    requestDelete,
    moveInvoice,
  };
}
