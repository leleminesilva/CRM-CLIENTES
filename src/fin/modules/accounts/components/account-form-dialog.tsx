"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
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
import { Switch } from "@fin/components/ui/switch";
import { handleActionResult } from "@fin/lib/action-result";
import type { ISODate } from "@fin/lib/dates";
import { createAccountAction, updateAccountAction } from "../actions";
import { ACCOUNT_TYPES, createAccountSchema } from "../schemas";
import { ACCOUNT_TYPE_DEFAULTS, ACCOUNT_TYPE_LABELS, type AccountDTO } from "../types";
import { BANK_COLORS } from "./bank-colors";

type Values = z.input<typeof createAccountSchema>;
type Output = z.output<typeof createAccountSchema>;

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountDTO;
  today: ISODate;
}

export function AccountFormDialog({ open, onOpenChange, account, today }: AccountFormDialogProps) {
  const editing = Boolean(account);
  const defaults = React.useMemo<Values>(
    () => ({
      name: account?.name ?? "",
      type: account?.type ?? "CHECKING",
      institution: account?.institution ?? "",
      initialBalance: account ? moneyToInput(account.initialBalance) : "",
      initialBalanceDate: account?.initialBalanceDate ?? today,
      isLiquid: account?.isLiquid ?? true,
      includeInNetWorth: account?.includeInNetWorth ?? true,
      color: account?.color ?? null,
    }),
    [account, today],
  );
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const colorLabelId = React.useId();

  React.useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  async function onSubmit(values: Output) {
    const result = account
      ? await updateAccountAction({ ...values, id: account.id })
      : await createAccountAction(values);
    if (handleActionResult(result, form)) {
      toast.success(account ? "Conta salva" : "Conta criada");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            O saldo atual é calculado a partir do saldo inicial e dos lançamentos pagos ou
            recebidos.
          </DialogDescription>
        </DialogHeader>

        <form
          id="account-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="grid gap-4"
        >
          <Field label="Nome" error={errors.name?.message}>
            {(a) => (
              <Input
                {...a}
                placeholder="Ex.: Itaú, Nubank, Carteira"
                autoFocus
                {...form.register("name")}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" error={errors.type?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        const type = v as Values["type"];
                        field.onChange(type);
                        // Ajusta os padrões do tipo, sem sobrescrever o que a pessoa já mexeu.
                        const d = ACCOUNT_TYPE_DEFAULTS[type];
                        if (!dirtyFields.isLiquid) form.setValue("isLiquid", d.isLiquid);
                        if (!dirtyFields.includeInNetWorth)
                          form.setValue("includeInNetWorth", d.includeInNetWorth);
                      }}
                    >
                      <SelectTrigger id={a.id} aria-invalid={a["aria-invalid"]}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACCOUNT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label="Instituição" aside="opcional" error={errors.institution?.message}>
              {(a) => (
                <Input {...a} placeholder="Ex.: Itaú Unibanco" {...form.register("institution")} />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Saldo inicial"
              hint="O saldo da conta nesta data. Pode ser negativo."
              error={errors.initialBalance?.message}
            >
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("initialBalance")} />}
            </Field>
            <Field label="Data do saldo" error={errors.initialBalanceDate?.message}>
              {(a) => <Input {...a} type="date" {...form.register("initialBalanceDate")} />}
            </Field>
          </div>

          <div className="grid gap-2">
            <span id={colorLabelId} className="text-[13px] leading-4 font-medium text-ink-2">
              Cor
            </span>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <ColorSwatches
                  aria-labelledby={colorLabelId}
                  value={field.value}
                  onChange={field.onChange}
                  colors={BANK_COLORS}
                  allowNone
                />
              )}
            />
          </div>

          <div className="grid gap-3 rounded-card border border-line bg-surface p-3">
            <Controller
              control={form.control}
              name="isLiquid"
              render={({ field }) => (
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">Compõe o saldo disponível</span>
                    <span className="text-xs text-ink-3">
                      Desligue para reservas, investimentos e vales.
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <Controller
              control={form.control}
              name="includeInNetWorth"
              render={({ field }) => (
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">Entra no patrimônio</span>
                    <span className="text-xs text-ink-3">
                      Soma no cálculo de patrimônio líquido.
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="account-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : editing ? "Salvar conta" : "Criar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
