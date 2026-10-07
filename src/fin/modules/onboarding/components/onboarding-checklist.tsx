"use client";

import { CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { handleActionResult } from "@fin/lib/action-result";
import { cn } from "@fin/lib/cn";
import { DEFAULT_REPEAT } from "@fin/modules/transactions/components/repeat-fields";
import { useTransactionForm } from "@fin/modules/transactions/components/transaction-form-provider";
import { dismissOnboardingAction } from "../actions";
import type { OnboardingStep } from "../queries";

const COPY: Record<OnboardingStep["key"], { title: string; hint: string }> = {
  account: {
    title: "Cadastre suas contas",
    hint: "Conta corrente, poupança, carteira. Informe o saldo de hoje.",
  },
  card: {
    title: "Cadastre seus cartões",
    hint: "Com fechamento e vencimento, cada compra cai na fatura certa.",
  },
  income: {
    title: "Informe sua renda base",
    hint: "O salário que entra todo mês (ex.: 5º dia útil).",
  },
  fixed: {
    title: "Lance as despesas fixas",
    hint: "Aluguel, internet, academia: marque “Repetir”.",
  },
  installments: {
    title: "Parcelamentos em andamento",
    hint: "Já está pagando algo parcelado? Informe quantas parcelas foram.",
  },
};

/** Primeiros passos: os 10 minutos que deixam o sistema útil com os seus dados. */
export function OnboardingChecklist({
  steps,
  baseCategoryId,
}: {
  steps: OnboardingStep[];
  baseCategoryId: string | null;
}) {
  const form = useTransactionForm();

  const action = (key: OnboardingStep["key"]) => {
    switch (key) {
      case "account":
        return <Link href="/financeiro/contas">Cadastrar conta</Link>;
      case "card":
        return <Link href="/financeiro/cartoes">Cadastrar cartão</Link>;
      case "income":
        return (
          <button
            type="button"
            onClick={() =>
              form.openCreate({
                type: "INCOME",
                description: "Salário",
                categoryId: baseCategoryId,
                settled: false,
                repeat: { ...DEFAULT_REPEAT, dayRule: "NTH_BUSINESS_DAY", dayOfMonth: 5 },
              })
            }
          >
            Informar renda
          </button>
        );
      case "fixed":
        return (
          <button
            type="button"
            onClick={() =>
              form.openCreate({ type: "EXPENSE", settled: false, repeat: DEFAULT_REPEAT })
            }
          >
            Lançar despesa fixa
          </button>
        );
      case "installments":
        return (
          <button type="button" onClick={() => form.openInstallment()}>
            Cadastrar parcelamento
          </button>
        );
    }
  };

  return (
    <Panel className="grid gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-0.5">
          <h2 className="title-section">Comece por aqui</h2>
          <p className="text-[13px] text-ink-2">
            Cinco passos para o painel refletir a sua vida financeira. Leva uns 10 minutos.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ocultar primeiros passos"
          onClick={async () => {
            if (handleActionResult(await dismissOnboardingAction()))
              toast.success("Primeiros passos ocultados");
          }}
        >
          <XIcon />
        </Button>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "grid content-start gap-1.5 rounded-card border p-3",
              s.done ? "border-line bg-surface-sunken/50" : "border-line-strong",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[11px] nums",
                  s.done ? "bg-ink text-on-ink" : "border border-line-strong text-ink-2",
                )}
              >
                {s.done ? <CheckIcon className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              {COPY[s.key].title}
              {s.optional ? <span className="text-xs font-normal text-ink-3">opcional</span> : null}
            </span>
            <span className="text-xs leading-5 text-ink-3">{COPY[s.key].hint}</span>
            {!s.done ? (
              <span className="text-[13px] font-medium text-ink underline underline-offset-4 [&>*]:cursor-pointer">
                {action(s.key)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
