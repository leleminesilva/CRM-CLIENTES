"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { AccountSelect } from "@fin/components/shared/account-select";
import { ColorSwatches } from "@fin/components/shared/color-swatches";
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
import { Input } from "@fin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate, type ISODate } from "@fin/lib/dates";
import { BANK_COLORS } from "@fin/modules/accounts/components/bank-colors";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { createCardAction, updateCardAction } from "../actions";
import { resolveInvoice } from "../domain/invoice-cycle";
import { CARD_BRANDS, createCardSchema } from "../schemas";
import { BRAND_LABELS, type CardDTO } from "../types";

type Values = z.input<typeof createCardSchema>;
type Output = z.output<typeof createCardSchema>;

export function CardFormDialog({
  open,
  onOpenChange,
  card,
  accounts,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CardDTO;
  accounts: FormOptions["accounts"];
  today: ISODate;
}) {
  const defaults: Values = {
    name: card?.name ?? "",
    issuer: card?.issuer ?? "",
    brand: card?.brand ?? "MASTERCARD",
    lastFour: card?.lastFour ?? "",
    creditLimit: card ? moneyToInput(card.creditLimit) : "",
    closingDay: card?.closingDay ?? 3,
    dueDay: card?.dueDay ?? 10,
    paymentAccountId: card?.paymentAccountId ?? accounts[0]?.id ?? null,
    color: card?.color ?? null,
  };
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(createCardSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const closing = Number(useWatch({ control: form.control, name: "closingDay" }));
  const due = Number(useWatch({ control: form.control, name: "dueDay" }));
  const colorId = React.useId();
  const preview =
    closing >= 1 && closing <= 31 && due >= 1 && due <= 31
      ? resolveInvoice(today, closing, due)
      : null;

  async function onSubmit(values: Output) {
    const result = card
      ? await updateCardAction({ ...values, id: card.id })
      : await createCardAction(values);
    if (handleActionResult(result, form)) {
      toast.success(card ? "Cartão salvo" : "Cartão criado");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{card ? "Editar cartão" : "Novo cartão de crédito"}</DialogTitle>
          <DialogDescription>
            Com fechamento e vencimento, cada compra cai na fatura certa automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form
          id="card-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do cartão" error={errors.name?.message}>
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  placeholder="Ex.: Nubank Ultravioleta"
                  {...form.register("name")}
                />
              )}
            </Field>
            <Field label="Banco" error={errors.issuer?.message}>
              {(a) => <Input {...a} placeholder="Ex.: Nubank" {...form.register("issuer")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bandeira">
              {(a) => (
                <Controller
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={a.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARD_BRANDS.map((b) => (
                          <SelectItem key={b} value={b}>
                            {BRAND_LABELS[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label="Final" aside="opcional" error={errors.lastFour?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="lastFour"
                  render={({ field }) => (
                    <Input
                      {...a}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4821"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Limite" error={errors.creditLimit?.message}>
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("creditLimit")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dia do fechamento" error={errors.closingDay?.message}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  {...form.register("closingDay")}
                />
              )}
            </Field>
            <Field label="Dia do vencimento" error={errors.dueDay?.message}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  {...form.register("dueDay")}
                />
              )}
            </Field>
          </div>
          {preview ? (
            <p className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
              Uma compra feita hoje entra na fatura que fecha em {formatDate(preview.closingDate)} e
              vence em {formatDate(preview.dueDate)}.
            </p>
          ) : null}
          <Field label="Conta que paga a fatura" hint="Sugerida ao pagar; dá para trocar na hora.">
            {(a) => (
              <Controller
                control={form.control}
                name="paymentAccountId"
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
          <div className="grid gap-2">
            <span id={colorId} className="text-[13px] leading-4 font-medium text-ink-2">
              Cor
            </span>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <ColorSwatches
                  aria-labelledby={colorId}
                  value={field.value}
                  onChange={field.onChange}
                  colors={BANK_COLORS}
                  allowNone
                />
              )}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="card-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : card ? "Salvar cartão" : "Criar cartão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
