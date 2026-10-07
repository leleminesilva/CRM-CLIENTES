"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { Switch } from "@fin/components/ui/switch";
import { handleActionResult } from "@fin/lib/action-result";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { createGoalAction, updateGoalAction } from "../actions";
import type { GoalDTO } from "../queries";
import { GOAL_KINDS, createGoalSchema } from "../schemas";

type V = z.input<typeof createGoalSchema>;
type O = z.output<typeof createGoalSchema>;

export const KIND_LABELS: Record<(typeof GOAL_KINDS)[number], string> = {
  EMERGENCY_FUND: "Reserva de emergência",
  SAVINGS: "Poupança",
  PURCHASE: "Compra",
  INVESTMENT: "Investimento",
  DEBT_PAYOFF: "Quitar dívida",
  OTHER: "Outra",
};

export function GoalFormDialog({
  onClose,
  goal,
  accounts,
  hasEmergencyFund,
  defaultKind = "PURCHASE",
}: {
  onClose: () => void;
  goal?: GoalDTO;
  accounts: FormOptions["accounts"];
  hasEmergencyFund: boolean;
  defaultKind?: (typeof GOAL_KINDS)[number];
}) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      name: goal?.name ?? (defaultKind === "EMERGENCY_FUND" ? "Reserva de emergência" : ""),
      kind: goal?.kind ?? defaultKind,
      targetAmount: goal ? moneyToInput(goal.target) : "",
      initialAmount: goal ? moneyToInput(goal.initial) : "0,00",
      targetMonth: goal?.targetMonth ?? null,
      linkedAccountId: goal?.linkedAccount?.id ?? null,
      color: goal?.color ?? null,
      notes: goal?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const linked = useWatch({ control: form.control, name: "linkedAccountId" });

  async function onSubmit(values: O) {
    const result = goal
      ? await updateGoalAction({ ...values, id: goal.id })
      : await createGoalAction(values);
    if (handleActionResult(result, form)) {
      toast.success(goal ? "Meta salva" : "Meta criada");
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>
            Defina o valor e, se quiser, uma data. O sistema prevê quando você chega lá.
          </DialogDescription>
        </DialogHeader>
        <form
          id="goal-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" error={errors.name?.message}>
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  placeholder="Ex.: Comprar equipamento"
                  {...form.register("name")}
                />
              )}
            </Field>
            <Field label="Tipo" error={errors.kind?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={a.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOAL_KINDS.map((k) => (
                          <SelectItem
                            key={k}
                            value={k}
                            disabled={
                              k === "EMERGENCY_FUND" &&
                              hasEmergencyFund &&
                              goal?.kind !== "EMERGENCY_FUND"
                            }
                          >
                            {KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor da meta" error={errors.targetAmount?.message}>
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("targetAmount")} />}
            </Field>
            <Field label="Quero chegar até" aside="opcional" error={errors.targetMonth?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="targetMonth"
                  render={({ field }) => (
                    <Input
                      {...a}
                      type="month"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  )}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 rounded-card border border-line bg-surface p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Acompanhar o saldo de uma conta</span>
                <span className="text-xs text-ink-3">
                  O valor atual passa a ser o saldo da conta (ex.: a poupança da reserva).
                </span>
              </span>
              <Switch
                checked={Boolean(linked)}
                onCheckedChange={(on) =>
                  form.setValue("linkedAccountId", on ? (accounts[0]?.id ?? null) : null)
                }
              />
            </label>
            {linked ? (
              <Field label="Conta">
                {(a) => (
                  <Controller
                    control={form.control}
                    name="linkedAccountId"
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
            ) : (
              <Field label="Quanto já tem" error={errors.initialAmount?.message}>
                {(a) => <MoneyInput {...a} {...form.register("initialAmount")} />}
              </Field>
            )}
          </div>
          <Field label="Observações" aside="opcional">
            {(a) => <Textarea {...a} rows={2} {...form.register("notes")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="goal-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : goal ? "Salvar meta" : "Criar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
