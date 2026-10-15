"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
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
import { createEmployeeAction, updateEmployeeAction } from "../actions";
import type { PayrollRowDTO } from "../queries";
import { employeeSchema } from "../schemas";

type V = z.input<typeof employeeSchema>;
type O = z.output<typeof employeeSchema>;

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  users,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee?: PayrollRowDTO;
  users: { id: string; nome: string }[];
}) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee
      ? {
          name: employee.name,
          position: employee.position ?? "",
          salary: moneyToInput(employee.salary),
          payDay: employee.payDay,
          crmUserId: employee.crmUserId,
          notes: employee.notes ?? "",
        }
      : { name: "", position: "", salary: "", payDay: 5, crmUserId: null, notes: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: O) {
    const result = employee
      ? await updateEmployeeAction({ ...values, id: employee.employeeId })
      : await createEmployeeAction(values);
    if (handleActionResult(result, form)) {
      toast.success(employee ? "Funcionário salvo" : "Funcionário cadastrado");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{employee ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          <DialogDescription>
            O salário vira uma despesa a pagar todo mês, no dia escolhido, quando você gera a folha.
          </DialogDescription>
        </DialogHeader>
        <form id="employee-form" noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" error={errors.name?.message}>
              {(a) => <Input {...a} autoFocus {...form.register("name")} />}
            </Field>
            <Field label="Cargo" aside="opcional" error={errors.position?.message}>
              {(a) => <Input {...a} {...form.register("position")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Salário" error={errors.salary?.message}>
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("salary")} />}
            </Field>
            <Field label="Dia do pagamento" hint="De 1 a 28, todo mês." error={errors.payDay?.message}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={1}
                  max={28}
                  {...form.register("payDay", { valueAsNumber: true })}
                />
              )}
            </Field>
          </div>
          <Field
            label="Usuário do CRM"
            aside="opcional"
            hint="Se for um vendedor, as comissões dele aparecem ao lado do salário."
          >
            {(a) => (
              <select
                {...a}
                className="h-9 w-full rounded-control border border-line bg-surface px-3 text-sm"
                value={form.watch("crmUserId") ?? ""}
                onChange={(e) => form.setValue("crmUserId", e.target.value || null)}
              >
                <option value="">Nenhum</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
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
          <Button type="submit" form="employee-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
