"use client";

import * as React from "react";
import type { ISODate } from "@fin/lib/dates";
import type { FormOptions } from "../form-options";
import type { TransactionDTO } from "../types";
import {
  type PlanPrefill,
  PlanFormDialog,
} from "@fin/modules/installments/components/plan-form-dialog";
import { type FormMode, TransactionForm } from "./transaction-form";
import type { TransactionFormValues } from "./form-values";

interface TransactionFormApi {
  /** Contas, cartões e categorias já carregados (para atalhos como o lançamento por texto). */
  options: FormOptions;
  today: ISODate;
  /** Abre o cadastro rápido; `prefill` preenche campos (ex.: tipo). */
  openCreate: (prefill?: Partial<TransactionFormValues>) => void;
  openEdit: (transaction: TransactionDTO) => void;
  /** Abre o cadastro preenchido com os dados de um lançamento anterior, com a data de hoje. */
  openDuplicate: (transaction: TransactionDTO) => void;
  /** Abre a compra parcelada (opcionalmente preenchida). */
  openInstallment: (prefill?: PlanPrefill) => void;
}

const Context = React.createContext<TransactionFormApi | null>(null);

export function useTransactionForm(): TransactionFormApi {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error("useTransactionForm precisa estar dentro de TransactionFormProvider.");
  return ctx;
}

/** Um único diálogo de lançamento para o app inteiro, aberto pelo botão da barra, por `N` ou pelas listas. */
export function TransactionFormProvider({
  options,
  today,
  children,
}: {
  options: FormOptions;
  today: ISODate;
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<{ open: boolean; mode: FormMode; key: number }>({
    open: false,
    mode: { kind: "create" },
    key: 0,
  });

  const [plan, setPlan] = React.useState<{ key: number; prefill?: PlanPrefill } | null>(null);

  const api = React.useMemo<TransactionFormApi>(
    () => ({
      options,
      today,
      openInstallment: (prefill) => setPlan((p) => ({ key: (p?.key ?? 0) + 1, prefill })),
      openCreate: (prefill) =>
        setState((s) => ({ open: true, mode: { kind: "create", prefill }, key: s.key + 1 })),
      openEdit: (transaction) =>
        setState((s) => ({ open: true, mode: { kind: "edit", transaction }, key: s.key + 1 })),
      openDuplicate: (t) =>
        setState((s) => ({
          open: true,
          key: s.key + 1,
          mode: {
            kind: "create",
            prefill: {
              type: t.type === "INCOME" || t.type === "TRANSFER" ? t.type : "EXPENSE",
              description: t.description,
              amount: t.amount.replace(".", ","),
              date: today,
              dueDate: null,
              settled: t.status === "SETTLED" && !t.creditCard,
              accountId: t.account?.id ?? null,
              creditCardId: t.creditCard?.id ?? null,
              transferAccountId: t.transferAccount?.id ?? null,
              categoryId: t.category?.id ?? null,
              nature: t.nature,
              paymentMethod: t.paymentMethod,
              notes: "",
            },
          },
        })),
    }),
    [options, today],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=combobox]",
        )
      )
        return;
      e.preventDefault();
      api.openCreate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  return (
    <Context.Provider value={api}>
      {children}
      <TransactionForm
        key={state.key}
        open={state.open}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
        mode={state.mode}
        options={options}
        today={today}
        onInstallment={(prefill) => {
          setState((s) => ({ ...s, open: false }));
          setPlan((p) => ({ key: (p?.key ?? 0) + 1, prefill }));
        }}
      />
      {plan ? (
        <PlanFormDialog
          key={plan.key}
          open
          onOpenChange={(o) => !o && setPlan(null)}
          options={options}
          today={today}
          prefill={plan.prefill}
        />
      ) : null}
    </Context.Provider>
  );
}
