"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { AccountSelect } from "@fin/components/shared/account-select";
import { MoneyInput, moneyToInput } from "@fin/components/shared/money-input";
import { MoneyText } from "@fin/components/shared/money-text";
import { Button } from "@fin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fin/components/ui/dialog";
import { Field } from "@fin/components/ui/field";
import { Input } from "@fin/components/ui/input";
import { handleActionResult } from "@fin/lib/action-result";
import type { ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { settleEarlyAction } from "../actions";
import type { PlanDTO } from "../queries";
import { settleEarlySchema } from "../schemas";

type V = z.input<typeof settleEarlySchema>;
type O = z.output<typeof settleEarlySchema>;

export function SettleEarlyDialog({
  plan,
  accounts,
  today,
  onClose,
}: {
  plan: PlanDTO;
  accounts: FormOptions["accounts"];
  today: ISODate;
  onClose: () => void;
}) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(settleEarlySchema),
    defaultValues: {
      planId: plan.id,
      accountId: accounts[0]?.id ?? "",
      amount: moneyToInput(plan.outstanding),
      date: today,
    },
  });
  const { errors, isSubmitting } = form.formState;
  async function onSubmit(values: O) {
    if (handleActionResult(await settleEarlyAction(values), form)) {
      toast.success("Parcelamento quitado");
      onClose();
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Quitar “{plan.description}”</DialogTitle>
          <DialogDescription>
            As parcelas pendentes são canceladas e substituídas por um pagamento único — com
            desconto, se houver.
          </DialogDescription>
        </DialogHeader>
        <form
          id="settle-plan-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <p className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
            Saldo devedor: <MoneyText value={plan.outstanding} className="font-medium text-ink" />{" "}
            em {plan.remainingCount} parcelas
          </p>
          <Field label="Valor pago na quitação" error={errors.amount?.message}>
            {(a) => <MoneyInput {...a} {...form.register("amount")} />}
          </Field>
          <Field label="Conta" error={errors.accountId?.message}>
            {(a) => (
              <Controller
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <AccountSelect
                    {...a}
                    accounts={accounts}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
          </Field>
          <Field label="Data" error={errors.date?.message}>
            {(a) => <Input {...a} type="date" {...form.register("date")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="settle-plan-form" disabled={isSubmitting}>
            {isSubmitting ? "Quitando…" : "Quitar parcelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
