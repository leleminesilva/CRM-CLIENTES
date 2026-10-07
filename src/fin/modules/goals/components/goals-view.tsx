"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArchiveIcon,
  EllipsisIcon,
  PauseIcon,
  PencilIcon,
  PiggyBankIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyInput } from "@fin/components/shared/money-input";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { Badge } from "@fin/components/ui/badge";
import { Button } from "@fin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fin/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { Field } from "@fin/components/ui/field";
import { Input } from "@fin/components/ui/input";
import { handleActionResult } from "@fin/lib/action-result";
import { cn } from "@fin/lib/cn";
import { formatDate, formatMonth, type ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import {
  addContributionAction,
  deleteContributionAction,
  deleteGoalAction,
  setGoalStatusAction,
} from "../actions";
import type { EmergencyFundSummary, GoalDTO } from "../queries";
import { contributionSchema } from "../schemas";
import { GoalFormDialog, KIND_LABELS } from "./goal-form-dialog";

export function GoalsView({
  goals,
  fund,
  accounts,
  today,
}: {
  goals: GoalDTO[];
  fund: EmergencyFundSummary;
  accounts: FormOptions["accounts"];
  today: ISODate;
}) {
  const [form, setForm] = React.useState<{ goal?: GoalDTO; kind?: "EMERGENCY_FUND" } | null>(null);
  const [contrib, setContrib] = React.useState<GoalDTO | null>(null);
  const [deleting, setDeleting] = React.useState<GoalDTO | null>(null);
  const others = goals.filter((g) => g.kind !== "EMERGENCY_FUND");

  async function setStatus(g: GoalDTO, status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    if (handleActionResult(await setGoalStatusAction({ id: g.id, status })))
      toast.success(
        status === "ARCHIVED"
          ? `“${g.name}” arquivada`
          : status === "PAUSED"
            ? `“${g.name}” pausada`
            : `“${g.name}” retomada`,
      );
  }

  const card = (g: GoalDTO) => (
    <li
      key={g.id}
      className={cn(
        "grid gap-3 px-4 py-4 sm:px-5",
        g.status !== "ACTIVE" && "bg-surface-sunken/50",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{g.name}</span>
            <Badge variant="outline">{KIND_LABELS[g.kind]}</Badge>
            {g.status === "PAUSED" ? <Badge>pausada</Badge> : null}
            {g.achieved ? <Badge variant="ink">atingida</Badge> : null}
          </span>
          <span className="text-[13px] text-ink-3">
            {g.linkedAccount
              ? `Acompanha o saldo de ${g.linkedAccount.name}`
              : "Aportes registrados à mão"}
            {g.targetMonth ? ` · meta para ${formatMonth(g.targetMonth)}` : ""}
          </span>
        </div>
        <div className="grid justify-items-end text-right">
          <MoneyText value={g.current} variant="table" className="text-base font-medium" />
          <span className="text-xs text-ink-3">
            de <MoneyText value={g.target} />
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${g.name}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!g.linkedAccount ? (
              <DropdownMenuItem onSelect={() => setContrib(g)}>
                <PlusIcon /> Registrar aporte ou resgate
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setForm({ goal: g })}>
              <PencilIcon /> Editar
            </DropdownMenuItem>
            {g.status === "ACTIVE" ? (
              <DropdownMenuItem onSelect={() => void setStatus(g, "PAUSED")}>
                <PauseIcon /> Pausar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => void setStatus(g, "ACTIVE")}>
                <PlayIcon /> Retomar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void setStatus(g, "ARCHIVED")}>
              <ArchiveIcon /> Arquivar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setDeleting(g)}>
              <Trash2Icon /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(g.percent)}
        aria-label={`${g.name}: ${Math.round(g.percent)}% da meta`}
      >
        <div className="h-full rounded-full bg-ink" style={{ width: `${g.percent}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <span className="font-medium text-ink nums">{Math.round(g.percent)}%</span>
        {g.achieved ? (
          <span>Meta atingida 🎯</span>
        ) : (
          <>
            <span>
              Faltam <MoneyText value={g.remaining} className="font-medium text-ink" />
            </span>
            {g.etaMonth ? (
              <span>
                No ritmo de <MoneyText value={g.monthlyPace} /> por mês, chega em{" "}
                <span className="font-medium text-ink first-letter:uppercase">
                  {formatMonth(g.etaMonth)}
                </span>
              </span>
            ) : (
              <span className="text-ink-3">Sem aportes recentes para prever a data</span>
            )}
            {g.requiredMonthly ? (
              <span className={g.onTrack === false ? "text-critical" : ""}>
                Para chegar em {formatMonth(g.targetMonth!)}:{" "}
                <MoneyText value={g.requiredMonthly} className="font-medium" /> por mês
                {g.onTrack === false ? " — acima do seu ritmo" : ""}
              </span>
            ) : null}
          </>
        )}
      </div>
    </li>
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Metas"
        description="Objetivos com valor, progresso e previsão de quando você chega lá — incluindo a reserva de emergência."
        actions={
          <Button onClick={() => setForm({})}>
            <PlusIcon /> Nova meta
          </Button>
        }
      />

      <Panel className="grid gap-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
          <h2 className="title-section">Reserva de emergência</h2>
        </div>
        {fund.goal ? (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="grid gap-1">
                <span className="text-[13px] text-ink-2">Reserva atual</span>
                <MoneyText value={fund.reserve} variant="kpi" />
              </div>
              <div className="grid gap-1">
                <span className="text-[13px] text-ink-2">Custo médio mensal</span>
                <MoneyText value={fund.monthlyCost} variant="kpi" />
                <span className="text-xs text-ink-3">
                  {fund.costMonthsUsed
                    ? `Despesas pagas em ${fund.costMonthsUsed} ${fund.costMonthsUsed === 1 ? "mês" : "meses"}`
                    : "Ainda sem despesas pagas"}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-[13px] text-ink-2">Cobre</span>
                <span
                  className={cn(
                    "figure-kpi",
                    fund.months && Number.parseFloat(fund.months) < 3 && "text-critical",
                  )}
                >
                  {fund.months ? `${fund.months.replace(".", ",")} meses` : "—"}
                </span>
                <span className="text-xs text-ink-3">de despesas · recomendado: 3 a 6</span>
              </div>
              <div className="grid gap-1">
                <span className="text-[13px] text-ink-2">Só o essencial</span>
                <span className="figure-kpi">
                  {fund.essentialMonths ? `${fund.essentialMonths.replace(".", ",")} meses` : "—"}
                </span>
                <span className="text-xs text-ink-3">
                  custo essencial: <MoneyText value={fund.essentialCost} />
                </span>
              </div>
            </div>
            <ul className="-mx-5 -mb-5 border-t border-line">{card(fund.goal)}</ul>
          </>
        ) : (
          <EmptyState
            icon={ShieldCheckIcon}
            title="Cadastre sua reserva de emergência"
            description="Informe a meta e onde o dinheiro está guardado: o sistema mostra quantos meses de despesas ela cobre."
            action={
              <Button onClick={() => setForm({ kind: "EMERGENCY_FUND" })}>
                <PlusIcon /> Criar reserva
              </Button>
            }
          />
        )}
      </Panel>

      <section className="grid gap-2">
        <h2 className="title-section">Outras metas</h2>
        <Panel className="overflow-hidden">
          {others.length === 0 ? (
            <EmptyState
              icon={PiggyBankIcon}
              title="Nenhuma meta ainda"
              description="Comprar um equipamento, viajar, quitar uma dívida: crie a meta, registre aportes e acompanhe."
              action={
                <Button onClick={() => setForm({})}>
                  <PlusIcon /> Nova meta
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">{others.map(card)}</ul>
          )}
        </Panel>
      </section>

      {form ? (
        <GoalFormDialog
          key={form.goal?.id ?? "novo"}
          onClose={() => setForm(null)}
          goal={form.goal}
          accounts={accounts}
          hasEmergencyFund={Boolean(fund.goal)}
          defaultKind={form.kind}
        />
      ) : null}
      {contrib ? (
        <ContributionDialog goal={contrib} today={today} onClose={() => setContrib(null)} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description={
          <p>
            A meta e os aportes registrados serão apagados. Para guardar o histórico, prefira
            arquivar.
          </p>
        }
        confirmLabel="Excluir meta"
        onConfirm={async () => {
          if (deleting && handleActionResult(await deleteGoalAction({ id: deleting.id })))
            toast.success("Meta excluída");
        }}
      />
    </div>
  );
}

function ContributionDialog({
  goal,
  today,
  onClose,
}: {
  goal: GoalDTO;
  today: ISODate;
  onClose: () => void;
}) {
  type V = z.input<typeof contributionSchema>;
  type O = z.output<typeof contributionSchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { goalId: goal.id, amount: "", date: today, notes: "" },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Aporte em “{goal.name}”</DialogTitle>
          <DialogDescription>Use valor negativo para registrar um resgate.</DialogDescription>
        </DialogHeader>
        <form
          id="contribution-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            if (handleActionResult(await addContributionAction(v), form)) {
              toast.success("Aporte registrado");
              onClose();
            }
          })}
        >
          <Field label="Valor" error={errors.amount?.message}>
            {(a) => <MoneyInput {...a} autoFocus placeholder="0,00" {...form.register("amount")} />}
          </Field>
          <Field label="Data" error={errors.date?.message}>
            {(a) => <Input {...a} type="date" {...form.register("date")} />}
          </Field>
        </form>
        {goal.contributions.length ? (
          <ul className="grid max-h-36 gap-1 overflow-y-auto text-[13px]">
            {goal.contributions.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-ink-2">
                <span>{formatDate(c.date)}</span>
                <MoneyText
                  value={c.amount}
                  sign="always"
                  tone={c.amount.startsWith("-") ? "default" : "positive"}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover aporte de ${formatDate(c.date)}`}
                  onClick={async () =>
                    handleActionResult(await deleteContributionAction({ id: c.id })) &&
                    toast.success("Aporte removido")
                  }
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Fechar
          </Button>
          <Button type="submit" form="contribution-form" disabled={isSubmitting}>
            Registrar aporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
