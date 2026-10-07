"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { AccountSelect } from "@fin/components/shared/account-select";
import { CategoryCombobox } from "@fin/components/shared/category-combobox";
import { MoneyInput } from "@fin/components/shared/money-input";
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
import { Segmented } from "@fin/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate, formatMonth, type ISODate } from "@fin/lib/dates";
import { formatMoney, parseMoneyInput } from "@fin/lib/money";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { createPlanAction } from "../actions";
import { planInstallments } from "../domain/installments";
import { createPlanSchema } from "../schemas";
import { resolveInvoice } from "@fin/modules/credit-cards/domain/invoice-cycle";

type V = z.input<typeof createPlanSchema>;
type O = z.output<typeof createPlanSchema>;

export interface PlanPrefill {
  description?: string;
  totalAmount?: string;
  categoryId?: string | null;
  creditCardId?: string | null;
  purchaseDate?: ISODate;
}

export function PlanFormDialog({
  open,
  onOpenChange,
  options,
  today,
  prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: FormOptions;
  today: ISODate;
  prefill?: PlanPrefill;
}) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      description: prefill?.description ?? "",
      merchant: "",
      categoryId: prefill?.categoryId ?? "",
      totalAmount: prefill?.totalAmount ?? "",
      cashPrice: "",
      installmentCount: 12,
      priorPaidCount: 0,
      purchaseDate: prefill?.purchaseDate ?? today,
      creditCardId: prefill?.creditCardId ?? options.cards[0]?.id ?? null,
      accountId: options.cards.length ? null : (options.accounts[0]?.id ?? null),
      firstDueDate: null,
      paymentMethod: null,
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const w = useWatch({ control: form.control });
  const onCard = Boolean(w.creditCardId);
  const card = options.cards.find((c) => c.id === w.creditCardId);

  const preview = React.useMemo(() => {
    const total = parseMoneyInput(String(w.totalAmount ?? ""));
    const count = Number(w.installmentCount);
    const prior = Number(w.priorPaidCount ?? 0);
    if (!total || !Number.isInteger(count) || count < 2 || !w.purchaseDate) return null;
    try {
      const plan = planInstallments({
        totalAmount: total.toFixed(2),
        count,
        priorPaidCount: prior,
        purchaseDate: w.purchaseDate,
        card: card ? { closingDay: card.closingDay, dueDay: card.dueDay } : undefined,
        firstDueDate: w.firstDueDate ?? undefined,
      });
      return { plan, each: total.dividedBy(count).toDecimalPlaces(2).toFixed(2) };
    } catch {
      return null;
    }
  }, [w.totalAmount, w.installmentCount, w.priorPaidCount, w.purchaseDate, w.firstDueDate, card]);

  async function onSubmit(values: O) {
    if (handleActionResult(await createPlanAction(values), form)) {
      toast.success("Compra parcelada criada");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nova compra parcelada</DialogTitle>
          <DialogDescription>
            O sistema gera as parcelas e mostra quanto ainda falta pagar mês a mês.
          </DialogDescription>
        </DialogHeader>
        <form
          id="plan-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="O que foi comprado" error={errors.description?.message}>
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  placeholder="Ex.: Sony FX30"
                  {...form.register("description")}
                />
              )}
            </Field>
            <Field label="Loja" aside="opcional">
              {(a) => <Input {...a} {...form.register("merchant")} />}
            </Field>
          </div>
          <Field label="Categoria" error={errors.categoryId?.message}>
            {(a) => (
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <CategoryCombobox
                    {...a}
                    groups={options.categories.expense}
                    value={field.value || null}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor total parcelado" error={errors.totalAmount?.message}>
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("totalAmount")} />}
            </Field>
            <Field label="Parcelas" error={errors.installmentCount?.message}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={2}
                  max={420}
                  inputMode="numeric"
                  {...form.register("installmentCount")}
                />
              )}
            </Field>
            <Field
              label="Já pagas"
              hint="Antes de usar o sistema"
              error={errors.priorPaidCount?.message}
            >
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...form.register("priorPaidCount")}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Data da compra"
              hint={Number(w.priorPaidCount) > 0 ? "Use a data da compra original." : undefined}
              error={errors.purchaseDate?.message}
            >
              {(a) => <Input {...a} type="date" {...form.register("purchaseDate")} />}
            </Field>
            <Field
              label="Preço à vista"
              aside="opcional"
              hint="Para mostrar os juros embutidos."
              error={errors.cashPrice?.message}
            >
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("cashPrice")} />}
            </Field>
          </div>

          <Segmented
            aria-label="Como foi parcelado"
            value={onCard ? "card" : "account"}
            onValueChange={(v) => {
              if (v === "card") {
                form.setValue("creditCardId", options.cards[0]?.id ?? null);
                form.setValue("accountId", null);
              } else {
                form.setValue("creditCardId", null);
                form.setValue("accountId", options.accounts[0]?.id ?? null);
              }
            }}
            options={[
              { value: "card", label: "Cartão de crédito", disabled: options.cards.length === 0 },
              { value: "account", label: "Boleto ou carnê" },
            ]}
            className="w-full"
          />

          {onCard ? (
            <Field label="Cartão">
              {(a) => (
                <Controller
                  control={form.control}
                  name="creditCardId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id={a.id}>
                        <SelectValue placeholder="Escolha o cartão" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.cards.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conta que paga" error={errors.accountId?.message}>
                {(a) => (
                  <Controller
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                      <AccountSelect
                        {...a}
                        accounts={options.accounts}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                )}
              </Field>
              <Field label="Vencimento da 1ª parcela" error={errors.firstDueDate?.message}>
                {(a) => (
                  <Controller
                    control={form.control}
                    name="firstDueDate"
                    render={({ field }) => (
                      <Input
                        {...a}
                        type="date"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    )}
                  />
                )}
              </Field>
            </div>
          )}

          {preview ? (
            <p
              className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2"
              aria-live="polite"
            >
              {Number(w.installmentCount)}× de {formatMoney(preview.each)}
              {preview.plan[0] ? (
                <>
                  {" · "}
                  {Number(w.priorPaidCount) > 0
                    ? `${preview.plan.length} restantes, a próxima`
                    : "1ª parcela"}{" "}
                  {card
                    ? `na fatura de ${formatMonth(resolveInvoice(preview.plan[0].date, card.closingDay, card.dueDay).referenceMonth)}`
                    : `em ${formatDate(preview.plan[0].dueDate)}`}
                </>
              ) : null}
            </p>
          ) : null}

          <Field label="Observações" aside="opcional">
            {(a) => <Textarea {...a} rows={2} {...form.register("notes")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="plan-form" disabled={isSubmitting}>
            {isSubmitting ? "Criando…" : "Criar parcelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
