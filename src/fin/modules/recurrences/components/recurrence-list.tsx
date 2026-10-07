"use client";

import { EllipsisIcon, PauseIcon, PlayIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
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
import { formatDate } from "@fin/lib/dates";
import { deleteRecurrenceAction, setRecurrencePausedAction } from "../actions";
import type { RecurrenceDTO } from "../queries";

function describe(r: RecurrenceDTO): string {
  const unit =
    r.frequency === "WEEKLY"
      ? ["semana", "semanas"]
      : r.frequency === "YEARLY"
        ? ["ano", "anos"]
        : ["mês", "meses"];
  const every =
    r.intervalCount === 1
      ? `${r.frequency === "WEEKLY" ? "toda" : "todo"} ${unit[0]}`
      : `a cada ${r.intervalCount} ${unit[1]}`;
  const day =
    r.frequency === "WEEKLY"
      ? ""
      : r.dayRule === "NTH_BUSINESS_DAY"
        ? `, ${r.dayOfMonth}º dia útil`
        : r.dayRule === "LAST_BUSINESS_DAY"
          ? ", último dia útil"
          : r.dayOfMonth
            ? `, dia ${r.dayOfMonth}`
            : "";
  return `${every.charAt(0).toUpperCase()}${every.slice(1)}${day}`;
}

/** Séries que geram lançamentos automaticamente (salário, aluguel, assinaturas…). */
export function RecurrenceList({
  items,
  title,
  description,
}: {
  items: RecurrenceDTO[];
  title: string;
  description?: string;
}) {
  const [deleting, setDeleting] = React.useState<RecurrenceDTO | null>(null);

  async function pause(r: RecurrenceDTO, paused: boolean) {
    if (handleActionResult(await setRecurrencePausedAction({ id: r.id, paused }))) {
      toast.success(paused ? `“${r.description}” pausada` : `“${r.description}” retomada`);
    }
  }

  if (items.length === 0) return null;
  return (
    <section className="grid gap-2">
      <div className="grid gap-0.5">
        <h2 className="flex items-center gap-2 title-section">
          <RepeatIcon className="size-4 text-ink-3" /> {title}
        </h2>
        {description ? <p className="text-[13px] text-ink-2">{description}</p> : null}
      </div>
      <Panel className="overflow-hidden">
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 px-4 py-3 ${r.paused ? "bg-surface-sunken/50" : ""}`}
            >
              {r.category ? (
                <CategoryIconChip icon={r.category.icon} color={r.category.color} />
              ) : (
                <span className="size-7" />
              )}
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{r.description}</span>
                  {r.paused ? <Badge>pausada</Badge> : null}
                  {r.isEstimatedAmount ? <Badge variant="outline">valor estimado</Badge> : null}
                </span>
                <span className="truncate text-[13px] text-ink-3">
                  {describe(r)}
                  {r.nextDueDate && !r.paused ? ` · próxima em ${formatDate(r.nextDueDate)}` : ""}
                  {r.account ? ` · ${r.account.name}` : ""}
                </span>
              </div>
              <div className="grid justify-items-end gap-0.5 text-right">
                <MoneyText value={r.amount} variant="table" className="text-sm font-medium" />
                {r.intervalCount !== 1 || r.frequency !== "MONTHLY" ? (
                  <span className="text-xs text-ink-3">
                    ≈ <MoneyText value={r.monthlyEquivalent} /> /mês
                  </span>
                ) : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${r.description}`}>
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {r.paused ? (
                    <DropdownMenuItem onSelect={() => void pause(r, false)}>
                      <PlayIcon /> Retomar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => void pause(r, true)}>
                      <PauseIcon /> Pausar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setDeleting(r)}>
                    <Trash2Icon /> Encerrar série
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </Panel>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Encerrar “${deleting?.description ?? ""}”?`}
        description={
          <p>
            As cobranças futuras ainda pendentes serão removidas. O que já foi pago ou editado
            continua no histórico.
          </p>
        }
        confirmLabel="Encerrar série"
        onConfirm={async () => {
          if (deleting && handleActionResult(await deleteRecurrenceAction({ id: deleting.id })))
            toast.success("Série encerrada");
        }}
      />
    </section>
  );
}
