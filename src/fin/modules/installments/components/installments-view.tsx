"use client";

import { LayersIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ChartFrame, ChartTable } from "@fin/components/charts/chart-frame";
import { MonthlyBars } from "@fin/components/charts/monthly-bars";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { formatMonth, type ISODate, monthKeyOf } from "@fin/lib/dates";
import { formatMoney, sumMoney, toMoneyString } from "@fin/lib/money";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import type { PlanDTO } from "../queries";
import { PlanCard } from "./plan-card";
import { PlanFormDialog } from "./plan-form-dialog";

interface Props {
  plans: PlanDTO[];
  impact: { month: string; amount: string }[];
  options: FormOptions;
  today: ISODate;
  showFinished: boolean;
}

export function InstallmentsView({ plans, impact, options, today, showFinished }: Props) {
  const [creating, setCreating] = React.useState(false);
  const active = plans.filter((p) => p.status === "ACTIVE");
  const outstanding = toMoneyString(sumMoney(active.map((p) => p.outstanding)));
  const nextMonth = impact.find((m) => m.amount !== "0.00");
  const lastDue = active
    .map((p) => p.lastDueDate)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Parcelamentos"
        description="Compras parceladas no cartão, boleto ou carnê: quanto já foi pago, quanto falta e quando termina."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link
                href={showFinished ? "/financeiro/parcelamentos" : "/financeiro/parcelamentos?concluidos=1"}
                replace
                scroll={false}
              >
                {showFinished ? "Ocultar concluídos" : "Mostrar concluídos"}
              </Link>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> Nova compra parcelada
            </Button>
          </>
        }
      />

      {active.length ? (
        <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="grid gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">Saldo devedor total</span>
            <MoneyText value={outstanding} variant="kpi" />
            <span className="text-xs text-ink-3">
              {active.length} {active.length === 1 ? "parcelamento ativo" : "parcelamentos ativos"}
            </span>
          </div>
          <div className="grid gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">Próximo mês com parcelas</span>
            <MoneyText value={nextMonth?.amount ?? "0"} variant="kpi" />
            <span className="text-xs text-ink-3">
              {nextMonth ? formatMonth(nextMonth.month) : ""}
            </span>
          </div>
          <div className="grid gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">Última parcela termina em</span>
            <span className="figure-kpi first-letter:uppercase">
              {lastDue ? formatMonth(monthKeyOf(lastDue), "short") : "—"}
            </span>
            <span className="text-xs text-ink-3 first-letter:uppercase">
              {lastDue ? formatMonth(monthKeyOf(lastDue)) : ""}
            </span>
          </div>
        </Panel>
      ) : null}

      {active.length ? (
        <ChartFrame
          question="Quanto as parcelas pesam nos próximos meses?"
          answer={
            nextMonth
              ? `${formatMoney(nextMonth.amount)} em ${formatMonth(nextMonth.month)}, diminuindo conforme as compras terminam.`
              : undefined
          }
          chart={
            <MonthlyBars
              data={impact.map((m) => ({ month: m.month, amount: Number(m.amount) }))}
              series={[{ key: "amount", name: "Parcelas", color: "var(--series-expense)" }]}
            />
          }
          table={
            <ChartTable
              head={["Mês", "Parcelas"]}
              rows={impact.map((m) => [formatMonth(m.month), formatMoney(m.amount)])}
            />
          }
          footnote="Soma das parcelas pendentes pelo mês de vencimento (no cartão, o mês da fatura)."
        />
      ) : null}

      <Panel>
        {plans.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            title="Nenhuma compra parcelada"
            description="Cadastre uma compra para ver as parcelas, o saldo devedor e o impacto nos próximos meses. Já está pagando? Informe quantas parcelas já foram."
            action={
              <Button onClick={() => setCreating(true)}>
                <PlusIcon /> Nova compra parcelada
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} accounts={options.accounts} today={today} />
            ))}
          </ul>
        )}
      </Panel>

      {creating ? (
        <PlanFormDialog open onOpenChange={setCreating} options={options} today={today} />
      ) : null}
    </div>
  );
}
