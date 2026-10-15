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
import { Switch } from "@fin/components/ui/switch";
import { handleActionResult } from "@fin/lib/action-result";
import { addDays, type ISODate } from "@fin/lib/dates";
import { formatMoney, parseMoneyInput } from "@fin/lib/money";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { createCommissionAction, updateCommissionAction } from "../actions";
import { computeCommission } from "../domain/commission";
import type { CommissionDTO } from "../queries";
import { commissionSchema } from "../schemas";

type V = z.input<typeof commissionSchema>;
type O = z.output<typeof commissionSchema>;

export function CommissionFormDialog({
  open,
  onOpenChange,
  commission,
  accounts,
  sellers,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  commission?: CommissionDTO;
  accounts: FormOptions["accounts"];
  /** Nomes sugeridos (usuários do CRM); o campo aceita qualquer nome. */
  sellers: string[];
  today: ISODate;
}) {
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(commissionSchema),
    defaultValues: commission
      ? {
          sellerName: commission.sellerName,
          clientName: commission.clientName,
          saleDescription: commission.saleDescription,
          saleAmount: moneyToInput(commission.saleAmount),
          ratePercent: commission.ratePercent.replace(".", ","),
          amountOverride: commission.isAmountOverridden ? moneyToInput(commission.amount) : "",
          saleDate: commission.saleDate,
          expectedDate: commission.expectedDate,
          received: commission.status === "SETTLED",
          receivedAt: commission.receivedAt,
          accountId: commission.account?.id ?? accounts[0]?.id ?? null,
          notes: commission.notes ?? "",
        }
      : {
          sellerName: "",
          clientName: "",
          saleDescription: "",
          saleAmount: "",
          ratePercent: "",
          amountOverride: "",
          saleDate: today,
          expectedDate: addDays(today, 30),
          received: false,
          receivedAt: null,
          accountId: accounts[0]?.id ?? null,
          notes: "",
        },
  });
  const { errors, isSubmitting } = form.formState;
  const sale = useWatch({ control: form.control, name: "saleAmount" });
  const rate = useWatch({ control: form.control, name: "ratePercent" });
  const received = useWatch({ control: form.control, name: "received" });
  const parsedSale = parseMoneyInput(String(sale ?? ""));
  const parsedRate = Number.parseFloat(String(rate ?? "").replace(",", "."));
  const computed =
    parsedSale && parsedRate > 0 && parsedRate <= 100
      ? computeCommission(parsedSale, parsedRate.toString())
      : null;

  async function onSubmit(values: O) {
    const result = commission
      ? await updateCommissionAction({ ...values, id: commission.id })
      : await createCommissionAction(values);
    if (handleActionResult(result, form)) {
      toast.success(commission ? "Comissão salva" : "Comissão registrada");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{commission ? "Editar comissão" : "Nova comissão"}</DialogTitle>
          <DialogDescription>
            A comissão vira uma despesa prevista na data de pagamento e entra na previsão de caixa.
          </DialogDescription>
        </DialogHeader>
        <form
          id="commission-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <Field label="Vendedor" error={errors.sellerName?.message}>
            {(a) => (
              <>
                <Input
                  {...a}
                  autoFocus
                  list="comissao-vendedores"
                  placeholder="Quem recebe a comissão"
                  {...form.register("sellerName")}
                />
                <datalist id="comissao-vendedores">
                  {sellers.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" error={errors.clientName?.message}>
              {(a) => <Input {...a} {...form.register("clientName")} />}
            </Field>
            <Field label="Venda ou projeto" error={errors.saleDescription?.message}>
              {(a) => <Input {...a} {...form.register("saleDescription")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor da venda" error={errors.saleAmount?.message}>
              {(a) => <MoneyInput {...a} placeholder="0,00" {...form.register("saleAmount")} />}
            </Field>
            <Field label="Percentual (%)" error={errors.ratePercent?.message}>
              {(a) => (
                <Input
                  {...a}
                  inputMode="decimal"
                  placeholder="5"
                  {...form.register("ratePercent")}
                />
              )}
            </Field>
            <div
              className="grid content-end gap-1 rounded-card bg-surface-sunken px-3 py-2"
              aria-live="polite"
            >
              <span className="text-xs text-ink-3">Comissão calculada</span>
              <span className="font-semibold nums">{computed ? formatMoney(computed) : "—"}</span>
            </div>
          </div>
          <Field
            label="Valor diferente do cálculo"
            aside="opcional"
            hint="Use se for pagar ao vendedor outro valor."
            error={errors.amountOverride?.message}
          >
            {(a) => (
              <MoneyInput
                {...a}
                placeholder={computed ? formatMoney(computed).replace("R$", "").trim() : "0,00"}
                {...form.register("amountOverride")}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da venda" error={errors.saleDate?.message}>
              {(a) => <Input {...a} type="date" {...form.register("saleDate")} />}
            </Field>
            <Field label="Previsão de pagamento" error={errors.expectedDate?.message}>
              {(a) => <Input {...a} type="date" {...form.register("expectedDate")} />}
            </Field>
          </div>
          <Controller
            control={form.control}
            name="received"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-card border border-line bg-surface px-3 py-2.5">
                <span className="text-sm font-medium">Já paguei</span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          {received ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conta de saída" error={errors.accountId?.message}>
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
              <Field label="Paga em">
                {(a) => (
                  <Controller
                    control={form.control}
                    name="receivedAt"
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
          ) : null}
          <Field label="Observações" aside="opcional">
            {(a) => <Textarea {...a} rows={2} {...form.register("notes")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="commission-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : commission ? "Salvar comissão" : "Registrar comissão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
