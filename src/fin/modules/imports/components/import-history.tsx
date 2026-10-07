"use client";

import { HistoryIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { handleActionResult } from "@fin/lib/action-result";
import { rollbackImportAction } from "../actions";
import type { ImportBatchDTO } from "../types";

const STATUS = {
  COMMITTED: "Importado",
  ROLLED_BACK: "Desfeito",
  DRAFT: "Em revisão",
  FAILED: "Falhou",
} as const;

export function ImportHistory({ batches }: { batches: ImportBatchDTO[] }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<ImportBatchDTO | null>(null);
  const action = useAction(rollbackImportAction);

  return (
    <Panel>
      <PanelHeader
        title="Histórico de importações"
        description="Cada arquivo vira um lote que pode ser desfeito inteiro."
      />
      {batches.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Nenhuma importação ainda"
          description="Os arquivos que você importar aparecem aqui."
        />
      ) : (
        <ul className="divide-y divide-line">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-medium">{b.fileName ?? "Arquivo"}</span>
                <span className="text-xs text-ink-3">
                  {new Date(b.createdAt).toLocaleString("pt-BR")} · {b.source} ·{" "}
                  {b.accountName ?? "—"} · {b.stats.imported} lançamentos
                  {b.stats.duplicates ? ` · ${b.stats.duplicates} repetidos ignorados` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-2">{STATUS[b.status]}</span>
                {b.status === "COMMITTED" ? (
                  <Button variant="secondary" size="sm" onClick={() => setTarget(b)}>
                    Desfazer
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Desfazer importação"
        description={
          target
            ? `Os ${target.liveCount} lançamentos de “${target.fileName}” vão para a lixeira e saem dos saldos e relatórios. Dá para restaurá-los de lá.`
            : null
        }
        confirmLabel="Desfazer importação"
        onConfirm={async () => {
          if (!target) return;
          const result = await action.executeAsync({ id: target.id });
          if (handleActionResult(result)) {
            toast.success("Importação desfeita.");
            router.refresh();
          }
          setTarget(null);
        }}
      />
    </Panel>
  );
}
