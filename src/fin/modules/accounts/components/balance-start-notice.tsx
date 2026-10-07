"use client";

import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import { startBalanceAtEarliestAction } from "../actions";
import type { AccountDTO } from "../types";

/**
 * Lançamentos pagos antes da data do saldo inicial ficam fora do saldo, mas entram nas receitas e
 * despesas do mês. Explica a diferença e oferece contar o saldo inicial desde o primeiro deles.
 */
export function BalanceStartNotice({ accounts }: { accounts: AccountDTO[] }) {
  const router = useRouter();
  const action = useAction(startBalanceAtEarliestAction);
  const affected = accounts.filter((a) => a.beforeStart && !a.archived);
  if (affected.length === 0) return null;
  const total = affected.reduce((n, a) => n + a.beforeStart!.count, 0);

  async function apply(account: AccountDTO) {
    const result = await action.executeAsync({ id: account.id });
    if (handleActionResult(result) && result?.data) {
      toast.success(
        `${account.name}: saldo inicial agora conta a partir de ${formatDate(result.data.initialBalanceDate)}.`,
      );
      router.refresh();
    }
  }

  return (
    <Panel
      className="grid gap-3 border-status-warning/50 p-4"
      role="region"
      aria-label="Lançamentos fora do saldo"
    >
      <p className="flex items-start gap-2 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
        <span>
          <strong>
            {total} {total === 1 ? "lançamento pago antes" : "lançamentos pagos antes"} da data do
            saldo inicial {total === 1 ? "não entra" : "não entram"} no saldo
          </strong>
          , mas {total === 1 ? "conta" : "contam"} nas receitas e despesas do mês. O sistema entende
          que o saldo inicial já os incluía. Se o saldo inicial era de antes desses lançamentos,
          conte a partir do primeiro deles.
        </span>
      </p>
      <ul className="grid gap-2">
        {affected.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span>
              <strong>{a.name}</strong>: saldo inicial de {formatMoney(a.initialBalance)} em{" "}
              {formatDate(a.initialBalanceDate)} · {a.beforeStart!.count} fora do saldo
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={action.isExecuting}
              onClick={() => void apply(a)}
            >
              Contar o saldo desde {formatDate(a.beforeStart!.earliest)}
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
