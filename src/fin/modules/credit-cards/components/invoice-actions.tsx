"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, ScaleIcon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { AccountSelect } from "@fin/components/shared/account-select";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
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
import { Switch } from "@fin/components/ui/switch";
import { handleActionResult } from "@fin/lib/action-result";
import type { ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { payInvoiceAction, reconcileInvoiceAction, undoInvoicePaymentsAction } from "../actions";
import { payInvoiceSchema, reconcileSchema } from "../schemas";
import type { InvoiceSummaryDTO } from "../types";

interface InvoiceActionsProps {
  invoice: InvoiceSummaryDTO;
  cardName: string;
  paymentAccountId: string | null;
  accounts: FormOptions["accounts"];
  today: ISODate;
  hasPayments: boolean;
}

export function InvoiceActions({
  invoice,
  cardName,
  paymentAccountId,
  accounts,
  today,
  hasPayments,
}: InvoiceActionsProps) {
  const [paying, setPaying] = React.useState(false);
  const [reconciling, setReconciling] = React.useState(false);
  const [undoing, setUndoing] = React.useState(false);
  const canPay =
    invoice.id !== null && invoice.status !== "PAID" && Number.parseFloat(invoice.remaining) > 0;

  return (
    <div className="flex flex-wrap gap-2">
      {canPay ? (
        <Button onClick={() => setPaying(true)}>
          <CheckIcon /> Pagar fatura
        </Button>
      ) : null}
      {invoice.id ? (
        <Button variant="secondary" onClick={() => setReconciling(true)}>
          <ScaleIcon /> Conferir com o banco
        </Button>
      ) : null}
      {hasPayments ? (
        <Button variant="secondary" onClick={() => setUndoing(true)}>
          <Undo2Icon /> Desfazer pagamento
        </Button>
      ) : null}

      {paying && invoice.id ? (
        <PayDialog
          invoice={invoice}
          cardName={cardName}
          paymentAccountId={paymentAccountId}
          accounts={accounts}
          today={today}
          onClose={() => setPaying(false)}
        />
      ) : null}
      {reconciling && invoice.id ? (
        <ReconcileDialog invoice={invoice} onClose={() => setReconciling(false)} />
      ) : null}
      <ConfirmDialog
        open={undoing}
        onOpenChange={setUndoing}
        title="Desfazer o pagamento desta fatura?"
        description={<p>O valor volta para a conta e as compras voltam a ficar pendentes.</p>}
        confirmLabel="Desfazer pagamento"
        onConfirm={async () => {
          if (
            invoice.id &&
            handleActionResult(await undoInvoicePaymentsAction({ invoiceId: invoice.id }))
          )
            toast.success("Pagamento desfeito");
        }}
      />
    </div>
  );
}

function PayDialog({
  invoice,
  cardName,
  paymentAccountId,
  accounts,
  today,
  onClose,
}: Omit<InvoiceActionsProps, "hasPayments"> & { onClose: () => void }) {
  type V = z.input<typeof payInvoiceSchema>;
  type O = z.output<typeof payInvoiceSchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(payInvoiceSchema),
    defaultValues: {
      invoiceId: invoice.id!,
      accountId: paymentAccountId ?? accounts[0]?.id ?? "",
      amount: moneyToInput(invoice.remaining),
      date: today > invoice.dueDate ? invoice.dueDate : today,
    },
  });
  const { errors, isSubmitting } = form.formState;
  async function onSubmit(values: O) {
    if (handleActionResult(await payInvoiceAction(values), form)) {
      toast.success(
        Number.parseFloat(values.amount) < Number.parseFloat(invoice.remaining)
          ? "Pagamento parcial registrado"
          : "Fatura paga",
      );
      onClose();
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Pagar fatura {cardName}</DialogTitle>
          <DialogDescription>
            O valor sai da conta escolhida. As compras não contam de novo como despesa — elas já
            foram contadas.
          </DialogDescription>
        </DialogHeader>
        <form
          id="pay-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <p className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
            Falta pagar: <MoneyText value={invoice.remaining} className="font-medium text-ink" />
          </p>
          <Field
            label="Valor"
            hint="Pode pagar só uma parte; o restante fica em aberto."
            error={errors.amount?.message}
          >
            {(a) => <MoneyInput {...a} {...form.register("amount")} />}
          </Field>
          {accounts.length === 0 ? (
            <p className="rounded-control border border-line-strong px-3 py-2 text-[13px] text-ink-2">
              Para pagar a fatura, cadastre a conta de onde o dinheiro sai.{" "}
              <Link href="/financeiro/contas" className="font-medium text-ink underline underline-offset-4">
                Cadastrar conta
              </Link>
            </p>
          ) : (
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
          )}
          <Field label="Data do pagamento" error={errors.date?.message}>
            {(a) => <Input {...a} type="date" {...form.register("date")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="pay-form" disabled={isSubmitting}>
            {isSubmitting ? "Pagando…" : "Pagar fatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceSummaryDTO;
  onClose: () => void;
}) {
  type V = z.input<typeof reconcileSchema>;
  type O = z.output<typeof reconcileSchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(reconcileSchema),
    defaultValues: {
      invoiceId: invoice.id!,
      statementAmount: invoice.statementAmount ? moneyToInput(invoice.statementAmount) : "",
      createAdjustment: true,
    },
  });
  const { errors, isSubmitting } = form.formState;
  async function onSubmit(values: O) {
    const result = await reconcileInvoiceAction(values);
    if (handleActionResult(result, form)) {
      const diff = result?.data?.difference ?? "0.00";
      toast.success(
        diff === "0.00"
          ? "Fatura confere com o banco"
          : values.createAdjustment
            ? "Diferença lançada na fatura"
            : "Valor do banco registrado",
      );
      onClose();
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Conferir com o banco</DialogTitle>
          <DialogDescription>
            Informe o total que o banco cobrou. Se for diferente da soma das compras, o sistema
            mostra e pode lançar a diferença.
          </DialogDescription>
        </DialogHeader>
        <form
          id="reconcile-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <p className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
            Soma das compras: <MoneyText value={invoice.total} className="font-medium text-ink" />
          </p>
          <Field label="Total da fatura no banco" error={errors.statementAmount?.message}>
            {(a) => <MoneyInput {...a} autoFocus {...form.register("statementAmount")} />}
          </Field>
          <Controller
            control={form.control}
            name="createAdjustment"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="grid gap-0.5">
                  <span className="text-sm">Lançar a diferença</span>
                  <span className="text-xs text-ink-3">
                    Juros, IOF ou compra esquecida vão para “Encargos do cartão”.
                  </span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="reconcile-form" disabled={isSubmitting}>
            {isSubmitting ? "Conferindo…" : "Conferir fatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
