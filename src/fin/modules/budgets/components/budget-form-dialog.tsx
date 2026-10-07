"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CategoryCombobox } from "@fin/components/shared/category-combobox";
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
import { handleActionResult } from "@fin/lib/action-result";
import { formatMonth, type MonthKey } from "@fin/lib/dates";
import type { CategoryNode } from "@fin/modules/categories/types";
import { setBudgetAction } from "../actions";
import { setBudgetSchema } from "../schemas";

type V = z.input<typeof setBudgetSchema>;
type O = z.output<typeof setBudgetSchema>;

interface Props {
  onClose: () => void;
  groups: CategoryNode[];
  month: MonthKey;
  initial?: { categoryId: string; amount: string; thresholdPercent: number };
  suggestion?: string | null;
}

export function BudgetFormDialog({ onClose, groups, month, initial, suggestion }: Props) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(setBudgetSchema),
    defaultValues: {
      categoryId: initial?.categoryId ?? "",
      amount: initial ? moneyToInput(initial.amount) : suggestion ? moneyToInput(suggestion) : "",
      fromMonth: month,
      alertThresholdPercent: initial?.thresholdPercent ?? 80,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: O) {
    if (handleActionResult(await setBudgetAction(values), form)) {
      toast.success("Limite salvo");
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar limite" : "Definir limite mensal"}</DialogTitle>
          <DialogDescription>
            Vale a partir de {formatMonth(month)}. Meses anteriores continuam com o limite que
            tinham.
            {suggestion && !initial ? " Sugestão: a média dos últimos 3 meses." : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          id="budget-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <Field
            label="Categoria"
            hint="Um grupo soma as subcategorias."
            error={errors.categoryId?.message}
          >
            {(a) => (
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <CategoryCombobox
                    {...a}
                    groups={groups}
                    value={field.value || null}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
          </Field>
          <Field label="Limite mensal" error={errors.amount?.message}>
            {(a) => <MoneyInput {...a} placeholder="0,00" autoFocus {...form.register("amount")} />}
          </Field>
          <Field label="Avisar ao atingir (%)" error={errors.alertThresholdPercent?.message}>
            {(a) => (
              <Input
                {...a}
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                className="w-28"
                {...form.register("alertThresholdPercent")}
              />
            )}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="budget-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar limite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
