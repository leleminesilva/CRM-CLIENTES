"use client";

import {
  CheckIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  UserMinusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { StatusBadge } from "@fin/components/shared/status-badge";
import { Button } from "@fin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { handleActionResult } from "@fin/lib/action-result";
import { formatMonth, type ISODate } from "@fin/lib/dates";
import { SettleDialog } from "@fin/modules/transactions/components/settle-dialog";
import {
  settleTransactionsAction,
  unsettleTransactionsAction,
} from "@fin/modules/transactions/actions";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { archiveEmployeeAction, generatePayrollAction } from "../actions";
import type { PayrollOverview, PayrollRowDTO } from "../queries";
import { EmployeeFormDialog } from "./employee-form-dialog";

interface Props {
  overview: PayrollOverview;
  month: string;
  currentMonth: string;
  accounts: FormOptions["accounts"];
  users: { id: string; nome: string }[];
  today: ISODate;
}

export function PayrollView({ overview, month, currentMonth, accounts, users, today }: Props) {
  const [form, setForm] = React.useState<{ e?: PayrollRowDTO } | null>(null);
  const [paying, setPaying] = React.useState<PayrollRowDTO | null>(null);
  const [archiving, setArchiving] = React.useState<PayrollRowDTO | null>(null);
  const [generating, setGenerating] = React.useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const result = await generatePayrollAction({ month });
      if (handleActionResult(result)) {
        const d = result?.data;
        toast.success(
          d && d.created > 0
            ? `Folha de ${formatMonth(month)} gerada: ${d.created} pagamentos`
            : "A folha deste mês já estava gerada",
        );
      }
    } finally {
      setGenerating(false);
    }
  }

  const kpis = [
    { label: "Folha do mês", value: overview.total },
    { label: "Paga", value: overview.paid },
    { label: "A pagar", value: overview.pending },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Salário"
        description="Folha de pagamento por funcionário. Gere a folha do mês e marque cada salário como pago."
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
            <Button variant="secondary" onClick={() => setForm({})}>
              <PlusIcon /> Novo funcionário
            </Button>
            <Button onClick={() => void generate()} disabled={generating || overview.rows.length === 0}>
              <WalletIcon /> {generating ? "Gerando…" : `Gerar folha de ${formatMonth(month)}`}
            </Button>
          </>
        }
      />

      <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {kpis.map((k) => (
          <div key={k.label} className="grid content-start gap-1 px-5 py-4">
            <span className="text-[13px] text-ink-2">{k.label}</span>
            <MoneyText value={k.value} variant="kpi" />
          </div>
        ))}
      </Panel>

      {overview.missing > 0 && overview.rows.length > 0 ? (
        <p className="text-[13px] text-ink-2">
          {overview.missing} {overview.missing === 1 ? "funcionário ainda sem pagamento" : "funcionários ainda sem pagamento"} em{" "}
          {formatMonth(month)}. Use “Gerar folha” para criar.
        </p>
      ) : null}

      <section className="grid gap-2">
        <h2 className="title-section">Funcionários — {formatMonth(month)}</h2>
        <Panel className="overflow-hidden">
          {overview.rows.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="Nenhum funcionário cadastrado"
              description="Cadastre cada funcionário com salário e dia de pagamento. Depois, gere a folha de cada mês."
              action={
                <Button onClick={() => setForm({})}>
                  <PlusIcon /> Novo funcionário
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {overview.rows.map((r) => (
                <li
                  key={r.employeeId}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3"
                >
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    <span className="truncate text-[13px] text-ink-3">
                      {r.position ? `${r.position} · ` : ""}salário base {formatMoneyBr(r.salary)} · paga no
                      dia {r.payDay}
                      {Number(r.commission) > 0 ? ` · comissões do mês ${formatMoneyBr(r.commission)}` : ""}
                    </span>
                  </div>
                  <div className="grid justify-items-end gap-0.5">
                    {r.entry ? (
                      <>
                        <MoneyText value={r.entry.amount} variant="table" sign="never" className="text-sm font-medium" />
                        <StatusBadge type="EXPENSE" status={r.entry.status} />
                      </>
                    ) : (
                      <span className="text-xs text-ink-3">Folha não gerada</span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${r.name}`}>
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.entry && (r.entry.status === "PENDING" || r.entry.status === "OVERDUE") ? (
                        <DropdownMenuItem onSelect={() => setPaying(r)}>
                          <CheckIcon /> Marcar como pago
                        </DropdownMenuItem>
                      ) : null}
                      {r.entry?.status === "SETTLED" ? (
                        <DropdownMenuItem
                          onSelect={async () => {
                            if (
                              r.entry &&
                              handleActionResult(await unsettleTransactionsAction({ ids: [r.entry.transactionId] }))
                            )
                              toast.success("Voltou para a pagar");
                          }}
                        >
                          <RotateCcwIcon /> Voltar para a pagar
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => setForm({ e: r })}>
                        <PencilIcon /> Editar funcionário
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setArchiving(r)}>
                        <UserMinusIcon /> Desligar funcionário
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {form ? (
        <EmployeeFormDialog open onOpenChange={(o) => !o && setForm(null)} employee={form.e} users={users} />
      ) : null}
      {paying?.entry ? (
        <SettleDialog
          open
          onOpenChange={(o) => !o && setPaying(null)}
          count={1}
          verb="pago"
          needsAccount={!paying.entry.account}
          accounts={accounts}
          today={today}
          onConfirm={async (input) => {
            if (
              paying.entry &&
              handleActionResult(
                await settleTransactionsAction({ ids: [paying.entry.transactionId], ...input }),
              )
            ) {
              toast.success(`Salário de ${paying.name} pago`);
              setPaying(null);
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Desligar ${archiving?.name ?? ""}?`}
        description={
          <p>
            Ele(a) deixa de entrar nas próximas folhas. Os pagamentos já gerados continuam no histórico
            de despesas.
          </p>
        }
        confirmLabel="Desligar"
        onConfirm={async () => {
          if (archiving && handleActionResult(await archiveEmployeeAction({ id: archiving.employeeId })))
            toast.success("Funcionário desligado");
        }}
      />
    </div>
  );
}

function formatMoneyBr(v: string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
