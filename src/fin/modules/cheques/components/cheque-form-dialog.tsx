"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { AccountSelect } from "@fin/components/shared/account-select";
import { MoneyInput, moneyToInput } from "@fin/components/shared/money-input";
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
import { Input, Textarea } from "@fin/components/ui/input";
import { handleActionResult } from "@fin/lib/action-result";
import type { ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { createChequeAction, updateChequeAction } from "../actions";
import type { ChequeDTO } from "../queries";
import { chequeSchema } from "../schemas";

type V = z.input<typeof chequeSchema>;
type O = z.output<typeof chequeSchema>;

export function ChequeFormDialog({
  open,
  onOpenChange,
  cheque,
  accounts,
  today,
  defaultDirection,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cheque?: ChequeDTO;
  accounts: FormOptions["accounts"];
  today: ISODate;
  defaultDirection: "ISSUED" | "RECEIVED";
}) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(chequeSchema),
    defaultValues: cheque
      ? {
          direction: cheque.direction,
          number: cheque.number,
          bank: cheque.bank ?? "",
          party: cheque.party,
          amount: moneyToInput(cheque.amount),
          issueDate: cheque.issueDate,
          dueDate: cheque.dueDate,
          accountId: cheque.account?.id ?? null,
          notes: cheque.notes ?? "",
        }
      : {
          direction: defaultDirection,
          number: "",
          bank: "",
          party: "",
          amount: "",
          issueDate: today,
          dueDate: today,
          accountId: null,
          notes: "",
        },
  });
  const { errors, isSubmitting } = form.formState;
  const direction = form.watch("direction");
  const issued = direction === "ISSUED";
  const locked = cheque?.status === "SETTLED";

  async function onSubmit(values: O) {
    const result = cheque
      ? await updateChequeAction({ ...values, id: cheque.id })
      : await createChequeAction(values);
    if (handleActionResult(result, form)) {
      toast.success(cheque ? "Cheque salvo" : "Cheque registrado");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{cheque ? "Editar cheque" : "Novo cheque"}</DialogTitle>
          <DialogDescription>
            {issued
              ? "O cheque emitido vira uma despesa a pagar na data do “bom para”."
              : "O cheque recebido vira uma receita a receber na data do “bom para”."}
          </DialogDescription>
        </DialogHeader>
        <form id="cheque-form" noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          {!cheque ? (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de cheque">
              {(["ISSUED", "RECEIVED"] as const).map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={direction === d ? "primary" : "secondary"}
                  onClick={() => form.setValue("direction", d)}
                >
                  {d === "ISSUED" ? "Emitido (a gente paga)" : "Recebido (a gente recebe)"}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número do cheque" error={errors.number?.message}>
              {(a) => <Input {...a} autoFocus {...form.register("number")} />}
            </Field>
            <Field label="Banco" aside="opcional" error={errors.bank?.message}>
              {(a) => <Input {...a} {...form.register("bank")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={issued ? "Favorecido" : "Emitente (quem passou o cheque)"} error={errors.party?.message}>
              {(a) => <Input {...a} {...form.register("party")} />}
            </Field>
            <Field label="Valor" error={errors.amount?.message}>
              {(a) => (
                <MoneyInput {...a} placeholder="0,00" disabled={locked} {...form.register("amount")} />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de emissão" error={errors.issueDate?.message}>
              {(a) => <Input {...a} type="date" {...form.register("issueDate")} />}
            </Field>
            <Field label="Bom para" hint="Data em que pode ser compensado." error={errors.dueDate?.message}>
              {(a) => <Input {...a} type="date" disabled={locked} {...form.register("dueDate")} />}
            </Field>
          </div>
          <Field label="Conta de compensação" aside="opcional" hint="Pode escolher depois, ao compensar.">
            {(a) => (
              <Controller
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <AccountSelect {...a} accounts={accounts} value={field.value} onChange={field.onChange} />
                )}
              />
            )}
          </Field>
          <Field label="Observações" aside="opcional">
            {(a) => <Textarea {...a} rows={2} {...form.register("notes")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="cheque-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : cheque ? "Salvar cheque" : "Registrar cheque"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
