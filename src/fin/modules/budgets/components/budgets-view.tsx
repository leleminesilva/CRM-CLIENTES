"use client";

import { EllipsisIcon, GaugeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { ProgressMeter } from "@fin/components/shared/progress-meter";
import { Badge } from "@fin/components/ui/badge";
import { Button } from "@fin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { handleActionResult } from "@fin/lib/action-result";
import { formatMonth, type MonthKey } from "@fin/lib/dates";
import type { CategoryNode } from "@fin/modules/categories/types";
import { removeBudgetAction } from "../actions";
import type { budgetOverview, BudgetRow } from "../queries";
import { BudgetFormDialog } from "./budget-form-dialog";

type Overview = Awaited<ReturnType<typeof budgetOverview>>;

export function BudgetsView({
  data,
  groups,
  month,
  currentMonth,
}: {
  data: Overview;
  groups: CategoryNode[];
  month: MonthKey;
  currentMonth: MonthKey;
}) {
  const [form, setForm] = React.useState<{
    initial?: BudgetRow;
    categoryId?: string;
    suggestion?: string | null;
  } | null>(null);
  const [removing, setRemoving] = React.useState<BudgetRow | null>(null);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Orçamento"
        description="Quanto você pode gastar em cada categoria no mês, com aviso antes de estourar."
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
            <Button onClick={() => setForm({})}>
              <PlusIcon /> Definir limite
            </Button>
          </>
        }
      />

      {data.rows.length > 0 ? (
        <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="grid gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">Limite total</span>
            <MoneyText value={data.totalLimit} variant="kpi" />
            <span className="text-xs text-ink-3">
              {data.rows.length} {data.rows.length === 1 ? "categoria" : "categorias"} com limite
            </span>
          </div>
          <div className="grid gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">Gasto nelas</span>
            <MoneyText value={data.totalSpent} variant="kpi" />
          </div>
          <div className="grid gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">Situação</span>
            <span className="figure-kpi">
              {data.over
                ? `${data.over} ${data.over === 1 ? "estourada" : "estouradas"}`
                : data.warning
                  ? `${data.warning} no limiar`
                  : "Em dia"}
            </span>
            <span className="text-xs text-ink-3">
              {data.over || data.warning
                ? "Veja as barras abaixo"
                : "Nenhuma categoria perto do limite"}
            </span>
          </div>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        {data.rows.length === 0 ? (
          <EmptyState
            icon={GaugeIcon}
            title="Nenhum limite definido para este mês"
            description="Defina quanto quer gastar por categoria (alimentação, lazer, transporte…) e acompanhe o consumo com uma barra de progresso."
            action={
              <Button onClick={() => setForm({})}>
                <PlusIcon /> Definir limite
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {data.rows.map((r) => (
              <li key={r.categoryId} className="grid gap-3 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <CategoryIconChip icon={r.icon} color={r.color} />
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Link
                      href={`/financeiro/lancamentos?mes=${month}&categoria=${r.categoryId}`}
                      className="truncate font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.state === "over" ? (
                      <Badge className="border-critical/40 text-critical">estourado</Badge>
                    ) : null}
                    {r.state === "warning" ? <Badge>no limiar</Badge> : null}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ações do limite de ${r.name}`}
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setForm({ initial: r })}>
                        <PencilIcon /> Editar limite
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setRemoving(r)}>
                        <Trash2Icon /> Remover limite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <ProgressMeter
                  value={r.spent}
                  limit={r.limit}
                  state={r.state}
                  label={`Orçamento de ${r.name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {data.unbudgeted.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="title-section">Sem limite</h2>
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-line">
              {data.unbudgeted.map((u) => (
                <li key={u.categoryId} className="flex items-center gap-3 px-4 py-2.5">
                  <CategoryIconChip icon={u.icon} color={u.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                  <span className="text-[13px] text-ink-2">
                    <MoneyText value={u.spent} variant="table" /> neste mês
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setForm({ categoryId: u.categoryId, suggestion: u.suggestion })}
                  >
                    Definir limite
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {form ? (
        <BudgetFormDialog
          key={form.initial?.categoryId ?? form.categoryId ?? "novo"}
          onClose={() => setForm(null)}
          groups={groups}
          month={month}
          initial={
            form.initial
              ? {
                  categoryId: form.initial.categoryId,
                  amount: form.initial.limit,
                  thresholdPercent: form.initial.thresholdPercent,
                }
              : form.categoryId
                ? {
                    categoryId: form.categoryId,
                    amount: form.suggestion ?? "",
                    thresholdPercent: 80,
                  }
                : undefined
          }
          suggestion={form.suggestion}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remover o limite de “${removing?.name ?? ""}”?`}
        description={
          <p>
            O limite deixa de valer a partir de {formatMonth(month)}. Meses anteriores continuam com
            o que tinham.
          </p>
        }
        confirmLabel="Remover limite"
        onConfirm={async () => {
          if (
            removing &&
            handleActionResult(
              await removeBudgetAction({ categoryId: removing.categoryId, fromMonth: month }),
            )
          )
            toast.success("Limite removido");
        }}
      />
    </div>
  );
}
