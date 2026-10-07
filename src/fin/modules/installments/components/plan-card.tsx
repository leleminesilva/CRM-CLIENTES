"use client";

import { CheckCheckIcon, EllipsisIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { MoneyText } from "@fin/components/shared/money-text";
import { Badge } from "@fin/components/ui/badge";
import { Button } from "@fin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate, formatMonth, type ISODate, monthKeyOf } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { deletePlanAction } from "../actions";
import type { PlanDTO } from "../queries";
import { SettleEarlyDialog } from "./settle-early-dialog";

const STATUS = {
  ACTIVE: null,
  FINISHED: "concluído",
  SETTLED_EARLY: "quitado antecipadamente",
  CANCELED: "cancelado",
} as const;

/** Uma compra parcelada: progresso (3/12), saldo devedor, próxima parcela e ações. */
export function PlanCard({
  plan,
  accounts,
  today,
}: {
  plan: PlanDTO;
  accounts: FormOptions["accounts"];
  today: ISODate;
}) {
  const [settling, setSettling] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const pct = Math.round((plan.paidCount / plan.installmentCount) * 100);

  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        {plan.category ? (
          <CategoryIconChip icon={plan.category.icon} color={plan.category.color} />
        ) : null}
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{plan.description}</span>
            {STATUS[plan.status] ? <Badge>{STATUS[plan.status]}</Badge> : null}
          </span>
          <span className="truncate text-[13px] text-ink-3">
            {plan.card ? plan.card.name : (plan.account?.name ?? "Boleto/carnê")} · comprado em{" "}
            {formatDate(plan.purchaseDate)}
            {plan.merchant ? ` · ${plan.merchant}` : ""}
          </span>
        </div>
        <div className="grid justify-items-end gap-0.5 text-right">
          <span className="text-sm">
            <span className="font-medium nums">
              {plan.paidCount}/{plan.installmentCount}
            </span>{" "}
            <span className="text-ink-3">pagas</span>
          </span>
          <span className="text-xs text-ink-3">
            {plan.installmentCount}× <MoneyText value={plan.installmentAmount} />
          </span>
        </div>
        {plan.status === "ACTIVE" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${plan.description}`}>
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSettling(true)}>
                <CheckCheckIcon /> Quitar antecipadamente
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
                <Trash2Icon /> Excluir compra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={plan.installmentCount}
        aria-valuenow={plan.paidCount}
        aria-label={`${plan.paidCount} de ${plan.installmentCount} parcelas pagas`}
      >
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        <span className="text-ink-2">
          Saldo devedor <MoneyText value={plan.outstanding} className="font-medium text-ink" />
        </span>
        <span className="text-ink-2">
          {plan.remainingCount} {plan.remainingCount === 1 ? "restante" : "restantes"}
        </span>
        {plan.nextDueDate ? (
          <span className="text-ink-2">Próxima: {formatDate(plan.nextDueDate)}</span>
        ) : null}
        {plan.lastDueDate && plan.status === "ACTIVE" ? (
          <span className="text-ink-3">Termina em {formatMonth(monthKeyOf(plan.lastDueDate))}</span>
        ) : null}
        {plan.interest && plan.interest !== "0.00" ? (
          <span className="text-ink-3">
            Juros embutidos <MoneyText value={plan.interest} />
          </span>
        ) : null}
      </div>

      {settling ? (
        <SettleEarlyDialog
          plan={plan}
          accounts={accounts}
          today={today}
          onClose={() => setSettling(false)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir “${plan.description}”?`}
        description={
          <p>
            As parcelas pendentes serão removidas e o limite do cartão liberado. Parcelas já pagas
            continuam no histórico.
          </p>
        }
        confirmLabel="Excluir compra"
        onConfirm={async () => {
          if (handleActionResult(await deletePlanAction({ id: plan.id })))
            toast.success("Compra parcelada excluída");
        }}
      />
    </li>
  );
}
