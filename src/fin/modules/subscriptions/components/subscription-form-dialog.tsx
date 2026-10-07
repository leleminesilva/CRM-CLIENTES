"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import type { ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { createSubscriptionAction } from "../actions";
import { subscriptionSchema } from "../schemas";

type V = z.input<typeof subscriptionSchema>;
type O = z.output<typeof subscriptionSchema>;

const BILLING = [
  { value: "MONTHLY", label: "Mensal" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "YEARLY", label: "Anual" },
] as const;

export function SubscriptionFormDialog({
  open,
  onOpenChange,
  options,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: FormOptions;
  today: ISODate;
}) {
  const defaultCategory =
    options.categories.expense.find((c) => c.name === "Assinaturas")?.id ?? "";
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: "",
      provider: "",
      website: "",
      amount: "",
      billing: "MONTHLY",
      nextChargeDate: today,
      categoryId: defaultCategory,
      creditCardId: options.cards[0]?.id ?? null,
      accountId: options.cards.length ? null : (options.accounts[0]?.id ?? null),
      trialEndsAt: null,
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const cardId = useWatch({ control: form.control, name: "creditCardId" });

  async function onSubmit(values: O) {
    if (handleActionResult(await createSubscriptionAction(values), form)) {
      toast.success("Assinatura cadastrada");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
          <DialogDescription>
            As cobranças entram como despesa fixa e aparecem no calendário e na previsão.
          </DialogDescription>
        </DialogHeader>
        <form
          id="subscription-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serviço" error={errors.name?.message}>
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  placeholder="Ex.: Adobe Creative Cloud"
                  {...form.register("name")}
                />
              )}
            </Field>
            <Field label="Site" aside="opcional" error={errors.website?.message}>
              {(a) => (
                <Input {...a} type="url" placeholder="https://" {...form.register("website")} />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor" error={errors.amount?.message}>
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("amount")} />}
            </Field>
            <Field label="Cobrança">
              {(a) => (
                <Controller
                  control={form.control}
                  name="billing"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={a.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label="Próxima cobrança" error={errors.nextChargeDate?.message}>
              {(a) => <Input {...a} type="date" {...form.register("nextChargeDate")} />}
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
          {options.cards.length ? (
            <Segmented
              aria-label="Paga com"
              value={cardId ? "card" : "account"}
              onValueChange={(v) => {
                form.setValue("creditCardId", v === "card" ? (options.cards[0]?.id ?? null) : null);
                form.setValue("accountId", v === "card" ? null : (options.accounts[0]?.id ?? null));
              }}
              options={[
                { value: "card", label: "Cartão de crédito" },
                { value: "account", label: "Débito em conta" },
              ]}
              className="w-full"
            />
          ) : null}
          {cardId ? (
            <Field label="Cartão">
              {(a) => (
                <Controller
                  control={form.control}
                  name="creditCardId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id={a.id}>
                        <SelectValue />
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
            <Field label="Conta" error={errors.accountId?.message}>
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
          )}
          <Field label="Fim do período de teste" aside="opcional">
            {(a) => (
              <Controller
                control={form.control}
                name="trialEndsAt"
                render={({ field }) => (
                  <Input
                    {...a}
                    type="date"
                    className="w-44"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
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
          <Button type="submit" form="subscription-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Cadastrar assinatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
