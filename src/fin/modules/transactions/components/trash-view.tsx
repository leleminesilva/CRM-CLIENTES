"use client";

import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate } from "@fin/lib/dates";
import { purgeTransactionsAction, restoreTransactionsAction } from "../actions";
import type { TransactionDTO } from "../types";
import { SignedAmount } from "./transaction-row";

type Item = TransactionDTO & { deletedAt: string | null };

export function TrashView({ items }: { items: Item[] }) {
  const [purging, setPurging] = React.useState<Item | null>(null);

  async function restore(item: Item) {
    if (handleActionResult(await restoreTransactionsAction({ ids: [item.id] })))
      toast.success(`“${item.description}” restaurado`);
  }

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Trash2Icon}
          title="A lixeira está vazia"
          description="Lançamentos excluídos ficam aqui por 30 dias antes de serem apagados de vez."
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-ink-2">
        Itens são apagados automaticamente 30 dias depois de excluídos.
      </p>
      <Panel className="overflow-hidden">
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm font-medium">{t.description}</span>
                <span className="truncate text-[13px] text-ink-3">
                  Vencimento {formatDate(t.dueDate)}
                  {t.deletedAt ? ` · excluído em ${formatDate(t.deletedAt.slice(0, 10))}` : ""}
                </span>
              </div>
              <span className="text-sm">
                <SignedAmount t={t} />
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void restore(t)}
                aria-label={`Restaurar ${t.description}`}
              >
                <RotateCcwIcon /> Restaurar
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Excluir definitivamente ${t.description}`}
                onClick={() => setPurging(t)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      <ConfirmDialog
        open={Boolean(purging)}
        onOpenChange={(open) => !open && setPurging(null)}
        title={`Excluir “${purging?.description ?? ""}” definitivamente?`}
        description={
          <p>O lançamento e seus anexos serão apagados de vez. Esta ação não pode ser desfeita.</p>
        }
        confirmLabel="Excluir definitivamente"
        onConfirm={async () => {
          if (purging && handleActionResult(await purgeTransactionsAction({ ids: [purging.id] })))
            toast.success("Excluído definitivamente");
        }}
      />
    </div>
  );
}
