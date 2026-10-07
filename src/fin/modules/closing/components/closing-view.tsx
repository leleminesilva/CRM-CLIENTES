"use client";

import { AlertTriangleIcon, CheckCircle2Icon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { Checkbox } from "@fin/components/ui/checkbox";
import { inputClasses } from "@fin/components/ui/input";
import { handleActionResult } from "@fin/lib/action-result";
import { formatMonth } from "@fin/lib/dates";
import { formatPercent, ratio, toMoney } from "@fin/lib/money";
import { closeMonthAction, reopenMonthAction } from "../actions";
import type { ClosingReview } from "../types";

function Delta({ now, before, goodWhenUp }: { now: string; before: string; goodWhenUp: boolean }) {
  const r = ratio(toMoney(now).minus(toMoney(before)), toMoney(before).abs());
  if (!r || r.isZero()) return <span className="text-xs text-ink-3">sem variação</span>;
  const up = r.greaterThan(0);
  return (
    <span className={`text-xs ${up === goodWhenUp ? "text-positive" : "text-critical"}`}>
      {up ? "▲" : "▼"} {formatPercent(r.abs())} vs mês anterior
    </span>
  );
}

export function ClosingView({ review, canReopen }: { review: ClosingReview; canReopen: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = React.useState("");
  const [conferred, setConferred] = React.useState(false);
  const [reopening, setReopening] = React.useState(false);
  const close = useAction(closeMonthAction);
  const reopen = useAction(reopenMonthAction);
  const { summary, checklist, closed, month, previous } = review;
  const attention = checklist.filter((c) => !c.ok).length;

  async function onClose() {
    const result = await close.executeAsync({ month, notes: notes.trim() || null });
    if (handleActionResult(result)) {
      toast.success(`${formatMonth(month)} fechado.`);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title={
            closed ? `Resumo congelado de ${formatMonth(month)}` : `Resumo de ${formatMonth(month)}`
          }
          description={
            closed
              ? "Estes valores ficaram registrados no fechamento."
              : "Valores de hoje; ao fechar, ficam registrados."
          }
        />
        <dl className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-[13px] text-ink-2">Receitas</dt>
            <dd className="mt-1 grid gap-1">
              <MoneyText value={summary.income} variant="kpi" />
              <Delta now={summary.income} before={previous.income} goodWhenUp />
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-2">Despesas</dt>
            <dd className="mt-1 grid gap-1">
              <MoneyText value={summary.expense} variant="kpi" />
              <Delta now={summary.expense} before={previous.expense} goodWhenUp={false} />
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-2">Resultado</dt>
            <dd className="mt-1 grid gap-1">
              <MoneyText
                value={summary.result}
                variant="kpi"
                sign="always"
                tone={summary.result.startsWith("-") ? "critical" : "positive"}
              />
              <span className="text-xs text-ink-3">
                {summary.savingsRate
                  ? `${formatPercent(toMoney(summary.savingsRate))} da renda sobrou`
                  : "sem receitas no mês"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-2">Patrimônio no fim do mês</dt>
            <dd className="mt-1 grid gap-1">
              <MoneyText value={summary.netWorth} variant="kpi" />
              {summary.topCategory ? (
                <span className="text-xs text-ink-3">
                  Maior gasto: {summary.topCategory.name} (
                  <MoneyText value={summary.topCategory.amount} variant="inline" />)
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Panel>

      {closed ? (
        <Panel className="grid gap-3 p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <LockIcon className="size-4" /> Fechado em{" "}
            {new Date(closed.closedAt).toLocaleDateString("pt-BR")}
          </p>
          {closed.notes ? (
            <p className="text-[13px] whitespace-pre-line text-ink-2">{closed.notes}</p>
          ) : null}
          {canReopen ? (
            <div>
              <Button variant="secondary" size="sm" onClick={() => setReopening(true)}>
                Reabrir mês
              </Button>
            </div>
          ) : null}
          <ConfirmDialog
            open={reopening}
            onOpenChange={setReopening}
            title="Reabrir mês"
            description={`O registro de fechamento de ${formatMonth(month)} será removido e o resumo volta a mostrar os valores de hoje. Seus lançamentos não mudam.`}
            confirmLabel="Reabrir mês"
            destructive={false}
            onConfirm={async () => {
              const result = await reopen.executeAsync({ month });
              if (handleActionResult(result)) {
                toast.success("Mês reaberto.");
                router.refresh();
              }
              setReopening(false);
            }}
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title="Conferências"
              description={
                attention === 0
                  ? "Tudo certo para fechar."
                  : `${attention} ${attention === 1 ? "ponto pede" : "pontos pedem"} atenção. Nenhum impede o fechamento.`
              }
            />
            <ul className="divide-y divide-line">
              {checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-5 py-3">
                  {c.ok ? (
                    <CheckCircle2Icon
                      className="mt-0.5 size-4 shrink-0 text-positive"
                      aria-label="Conferido"
                      role="img"
                    />
                  ) : (
                    <AlertTriangleIcon
                      className="mt-0.5 size-4 shrink-0 text-status-warning"
                      aria-label="Atenção"
                      role="img"
                    />
                  )}
                  <div className="grid flex-1 gap-0.5">
                    <span className="text-sm font-medium">{c.title}</span>
                    <span className="text-[13px] text-ink-2">{c.detail}</span>
                  </div>
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="text-[13px] font-medium underline-offset-4 hover:underline"
                    >
                      Resolver
                    </Link>
                  ) : null}
                </li>
              ))}
              <li className="px-5 py-3">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={conferred}
                    onCheckedChange={(v) => setConferred(v === true)}
                  />
                  <span className="grid gap-0.5">
                    <span className="font-medium">
                      Conferi os saldos das contas com o extrato do banco
                    </span>
                    <span className="text-[13px] text-ink-2">
                      Se algum saldo não bate, ajuste na tela da conta antes de fechar.
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </Panel>
          <Panel className="grid gap-4 p-5">
            <div className="grid gap-1.5">
              <label htmlFor="closing-notes" className="text-sm font-medium">
                Observações do mês (opcional)
              </label>
              <textarea
                id="closing-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="O que aconteceu de diferente? O que você quer fazer no próximo mês?"
                className={`${inputClasses} h-auto py-2`}
              />
            </div>
            <div>
              <Button onClick={() => void onClose()} disabled={!conferred || close.isExecuting}>
                Fechar {formatMonth(month)}
              </Button>
              {!conferred ? (
                <p className="mt-2 text-xs text-ink-3">
                  Marque a conferência de saldos para liberar o fechamento.
                </p>
              ) : null}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
