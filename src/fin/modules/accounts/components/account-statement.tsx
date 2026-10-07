"use client";

import { ScaleIcon } from "lucide-react";
import * as React from "react";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import type { ISODate } from "@fin/lib/dates";
import { formatDayMonth } from "@fin/lib/dates";
import { SignedAmount } from "@fin/modules/transactions/components/transaction-row";
import type { accountStatement } from "@fin/modules/transactions/queries";
import { AdjustBalanceDialog } from "./adjust-balance-dialog";

type Statement = Awaited<ReturnType<typeof accountStatement>>;

interface AccountStatementProps {
  account: { id: string; name: string; balance: string };
  statement: Statement;
  today: ISODate;
}

/** Extrato do mês: saldo de abertura, movimentos liquidados com saldo corrido, e o que está agendado. */
export function AccountStatement({ account, statement, today }: AccountStatementProps) {
  const [adjusting, setAdjusting] = React.useState(false);
  return (
    <div className="grid gap-6">
      <Panel className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Saldo de abertura</span>
          <MoneyText value={statement.opening} variant="kpi" />
        </div>
        <div className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Saldo no fim do mês</span>
          <MoneyText
            value={statement.closing}
            variant="kpi"
            tone={statement.closing.startsWith("-") ? "critical" : "default"}
          />
          <span className="text-xs text-ink-3">Considera só o que já foi pago ou recebido</span>
        </div>
        <div className="grid content-start gap-2 px-5 py-4">
          <span className="text-[13px] text-ink-2">Saldo atual calculado</span>
          <MoneyText value={account.balance} variant="kpi" />
          <div>
            <Button variant="secondary" size="sm" onClick={() => setAdjusting(true)}>
              <ScaleIcon /> Ajustar ao saldo do banco
            </Button>
          </div>
        </div>
      </Panel>

      <section className="grid gap-2">
        <h2 className="title-section">Movimentações do mês</h2>
        <Panel className="overflow-hidden">
          {statement.lines.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">
              Nenhuma movimentação paga ou recebida neste mês.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {statement.lines.map((l) => (
                <li
                  key={l.transaction.id}
                  className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[3rem_1fr_8rem_8rem]"
                >
                  <span className="text-[13px] text-ink-3 nums">
                    {formatDayMonth(l.transaction.settledAt ?? l.transaction.dueDate)}
                  </span>
                  <span className="grid min-w-0">
                    <span className="truncate text-sm font-medium">
                      {l.transaction.description}
                    </span>
                    <span className="truncate text-[13px] text-ink-3">
                      {l.transaction.category?.name ??
                        (l.transaction.type === "TRANSFER" ? "Transferência" : "")}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <MoneyText
                      value={l.delta}
                      variant="table"
                      sign="always"
                      tone={l.delta.startsWith("-") ? "default" : "positive"}
                    />
                  </span>
                  <span className="text-right text-[13px] text-ink-3 max-sm:hidden">
                    <MoneyText value={l.balanceAfter} variant="table" tone="muted" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {statement.scheduled.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="title-section">Ainda a acontecer neste mês</h2>
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-line">
              {statement.scheduled.map((t) => (
                <li
                  key={t.id}
                  className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-2.5"
                >
                  <span className="text-[13px] text-ink-3 nums">{formatDayMonth(t.dueDate)}</span>
                  <span className="truncate text-sm">{t.description}</span>
                  <span className="text-right text-sm">
                    <SignedAmount t={t} />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      <AdjustBalanceDialog
        open={adjusting}
        onOpenChange={setAdjusting}
        account={account}
        today={today}
      />
    </div>
  );
}
