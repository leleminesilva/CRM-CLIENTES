"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BanIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
} from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyInput, moneyToInput } from "@fin/components/shared/money-input";
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
import { formatDate, formatRelativeDay, type ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { changeSubscriptionAmountAction, setSubscriptionStatusAction } from "../actions";
import type { listSubscriptions, SubscriptionDTO } from "../queries";
import { updateSubscriptionAmountSchema } from "../schemas";
import { SubscriptionFormDialog } from "./subscription-form-dialog";

type Data = Awaited<ReturnType<typeof listSubscriptions>>;

export function SubscriptionsView({
  data,
  options,
  today,
}: {
  data: Data;
  options: FormOptions;
  today: ISODate;
}) {
  const [creating, setCreating] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState<SubscriptionDTO | null>(null);
  const [canceling, setCanceling] = React.useState<SubscriptionDTO | null>(null);
  const active = data.items.filter((i) => i.status === "ACTIVE");

  async function setStatus(s: SubscriptionDTO, status: "ACTIVE" | "PAUSED") {
    if (handleActionResult(await setSubscriptionStatusAction({ id: s.id, status })))
      toast.success(status === "PAUSED" ? `“${s.name}” pausada` : `“${s.name}” retomada`);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Assinaturas"
        description="Serviços que cobram sozinhos. Veja quanto custam por mês e por ano — e o que dá para cortar."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> Nova assinatura
          </Button>
        }
      />
      <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Custo mensal</span>
          <MoneyText value={data.monthlyTotal} variant="kpi" />
          <span className="text-xs text-ink-3">
            {active.length} {active.length === 1 ? "assinatura ativa" : "assinaturas ativas"}
          </span>
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Custo anual</span>
          <MoneyText value={data.yearlyTotal} variant="kpi" />
          <span className="text-xs text-ink-3">Inclui as anuais e trimestrais</span>
        </div>
        <div className="grid gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Renovações anuais em 30 dias</span>
          <span className="figure-kpi">{data.renewingSoon.length}</span>
          <span className="truncate text-xs text-ink-3">
            {data.renewingSoon.map((r) => r.name).join(", ") || "Nenhuma"}
          </span>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        {data.items.length === 0 ? (
          <EmptyState
            icon={RepeatIcon}
            title="Nenhuma assinatura cadastrada"
            description="Adobe, Netflix, Spotify, iCloud, academia… Cadastre e descubra quanto gasta por ano com serviços recorrentes."
            action={
              <Button onClick={() => setCreating(true)}>
                <PlusIcon /> Nova assinatura
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((s) => (
              <li
                key={s.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 ${s.status !== "ACTIVE" ? "bg-surface-sunken/50" : ""}`}
              >
                {s.category ? (
                  <CategoryIconChip icon={s.category.icon} color={s.category.color} />
                ) : (
                  <span className="size-7" />
                )}
                <div className="grid min-w-0 gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{s.name}</span>
                    {s.status === "PAUSED" ? <Badge>pausada</Badge> : null}
                    {s.status === "CANCELED" ? <Badge>cancelada</Badge> : null}
                    {s.trialEndsAt && s.trialEndsAt >= today ? (
                      <Badge variant="outline">teste até {formatDate(s.trialEndsAt)}</Badge>
                    ) : null}
                  </span>
                  <span className="truncate text-[13px] text-ink-3">
                    {s.billingLabel}
                    {s.paidWith ? ` · ${s.paidWith}` : ""}
                    {s.nextCharge ? ` · próxima ${formatRelativeDay(s.nextCharge, today)}` : ""}
                    {s.canceledAt ? ` · cancelada em ${formatDate(s.canceledAt)}` : ""}
                  </span>
                </div>
                <div className="grid justify-items-end gap-0.5 text-right">
                  <MoneyText value={s.amount} variant="table" className="text-sm font-medium" />
                  <span className="text-xs text-ink-3">
                    <MoneyText value={s.yearlyCost} /> /ano
                  </span>
                </div>
                {s.status !== "CANCELED" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${s.name}`}>
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setAdjusting(s)}>
                        <PencilIcon /> Reajustar valor
                      </DropdownMenuItem>
                      {s.status === "ACTIVE" ? (
                        <DropdownMenuItem onSelect={() => void setStatus(s, "PAUSED")}>
                          <PauseIcon /> Pausar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => void setStatus(s, "ACTIVE")}>
                          <PlayIcon /> Retomar
                        </DropdownMenuItem>
                      )}
                      {s.website ? (
                        <DropdownMenuItem asChild>
                          <a href={s.website} target="_blank" rel="noreferrer noopener">
                            <ExternalLinkIcon /> Abrir site
                          </a>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setCanceling(s)}>
                        <BanIcon /> Cancelar assinatura
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="w-8" />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {creating ? (
        <SubscriptionFormDialog open onOpenChange={setCreating} options={options} today={today} />
      ) : null}
      {adjusting ? (
        <AdjustDialog sub={adjusting} today={today} onClose={() => setAdjusting(null)} />
      ) : null}
      <ConfirmDialog
        open={Boolean(canceling)}
        onOpenChange={(o) => !o && setCanceling(null)}
        title={`Cancelar “${canceling?.name ?? ""}”?`}
        description={
          <p>As cobranças futuras deixam de aparecer. As já feitas continuam no histórico.</p>
        }
        confirmLabel="Cancelar assinatura"
        onConfirm={async () => {
          if (
            canceling &&
            handleActionResult(
              await setSubscriptionStatusAction({ id: canceling.id, status: "CANCELED" }),
            )
          )
            toast.success("Assinatura cancelada");
        }}
      />
    </div>
  );
}

function AdjustDialog({
  sub,
  today,
  onClose,
}: {
  sub: SubscriptionDTO;
  today: ISODate;
  onClose: () => void;
}) {
  type V = z.input<typeof updateSubscriptionAmountSchema>;
  type O = z.output<typeof updateSubscriptionAmountSchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(updateSubscriptionAmountSchema),
    defaultValues: {
      id: sub.id,
      amount: moneyToInput(sub.amount),
      fromDate: sub.nextCharge ?? today,
    },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Reajustar “{sub.name}”</DialogTitle>
          <DialogDescription>
            O novo valor vale a partir da data escolhida; cobranças anteriores não mudam.
          </DialogDescription>
        </DialogHeader>
        <form
          id="adjust-sub-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            if (handleActionResult(await changeSubscriptionAmountAction(v), form)) {
              toast.success("Valor reajustado");
              onClose();
            }
          })}
        >
          <Field label="Novo valor" error={errors.amount?.message}>
            {(a) => <MoneyInput {...a} autoFocus {...form.register("amount")} />}
          </Field>
          <Field label="A partir de" error={errors.fromDate?.message}>
            {(a) => <Input {...a} type="date" {...form.register("fromDate")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="adjust-sub-form" disabled={isSubmitting}>
            Reajustar valor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
