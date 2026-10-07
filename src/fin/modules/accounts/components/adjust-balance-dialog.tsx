"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { MoneyInput } from "@fin/components/shared/money-input";
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
import { adjustBalanceAction } from "@fin/modules/transactions/actions";
import { balanceAdjustmentSchema } from "@fin/modules/transactions/schemas";

type Values = z.input<typeof balanceAdjustmentSchema>;
type Output = z.output<typeof balanceAdjustmentSchema>;

interface AdjustBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: { id: string; name: string; balance: string };
  today: ISODate;
}

/** Confere o saldo com o do banco e lança a diferença como "ajuste" (fica fora dos relatórios). */
export function AdjustBalanceDialog({
  open,
  onOpenChange,
  account,
  today,
}: AdjustBalanceDialogProps) {
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(balanceAdjustmentSchema),
    defaultValues: { accountId: account.id, actualBalance: "", date: today },
  });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    if (open) form.reset({ accountId: account.id, actualBalance: "", date: today });
  }, [open, account.id, today, form]);

  async function onSubmit(values: Output) {
    if (handleActionResult(await adjustBalanceAction(values), form)) {
      toast.success("Saldo ajustado");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Ajustar saldo de {account.name}</DialogTitle>
          <DialogDescription>
            Informe o saldo que o banco mostra. O sistema lança a diferença como “Ajuste de saldo”,
            sem alterar seus relatórios de receitas e despesas.
          </DialogDescription>
        </DialogHeader>
        <form
          id="adjust-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <p className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
            Saldo calculado hoje:{" "}
            <MoneyText value={account.balance} className="font-medium text-ink" />
          </p>
          <Field label="Saldo no banco" error={errors.actualBalance?.message}>
            {(a) => (
              <MoneyInput {...a} placeholder="0,00" autoFocus {...form.register("actualBalance")} />
            )}
          </Field>
          <Field label="Data" error={errors.date?.message}>
            {(a) => <Input {...a} type="date" {...form.register("date")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="adjust-form" disabled={isSubmitting}>
            {isSubmitting ? "Ajustando…" : "Ajustar saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
