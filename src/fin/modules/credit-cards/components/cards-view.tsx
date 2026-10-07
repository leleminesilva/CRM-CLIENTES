"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CreditCardIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
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
import { formatDayMonth, formatMonth, type ISODate } from "@fin/lib/dates";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { deleteCardAction, setCardArchivedAction } from "../actions";
import { type CardDTO, INVOICE_STATUS_LABELS } from "../types";
import { CardArt } from "./card-art";
import { CardFormDialog } from "./card-form-dialog";
import { LimitMeter } from "./limit-meter";

export function CardsView({
  cards,
  accounts,
  today,
}: {
  cards: CardDTO[];
  accounts: FormOptions["accounts"];
  today: ISODate;
}) {
  const [form, setForm] = React.useState<{ card?: CardDTO } | null>(null);
  const [deleting, setDeleting] = React.useState<CardDTO | null>(null);

  async function archive(c: CardDTO, archived: boolean) {
    if (handleActionResult(await setCardArchivedAction({ id: c.id, archived })))
      toast.success(archived ? `“${c.name}” arquivado` : `“${c.name}” reativado`);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cartões"
        description="Limite, fatura atual e a próxima. Compras no cartão contam no mês da fatura."
        actions={
          <Button onClick={() => setForm({})}>
            <PlusIcon /> Novo cartão
          </Button>
        }
      />
      {cards.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CreditCardIcon}
            title="Cadastre seu primeiro cartão"
            description="Informe o limite e os dias de fechamento e vencimento. As compras vão para a fatura certa sozinhas."
            action={
              <Button onClick={() => setForm({})}>
                <PlusIcon /> Novo cartão
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((c) => (
            <Panel key={c.id} className={`grid gap-4 p-5 ${c.archived ? "border-dashed" : ""}`}>
              <div className="flex items-start gap-4">
                <Link
                  href={`/financeiro/cartoes/${c.id}`}
                  className="w-28 shrink-0 sm:w-32"
                  aria-label={`Abrir ${c.name}`}
                >
                  <CardArt name={c.name} issuer={c.issuer} lastFour={c.lastFour} color={c.color} />
                </Link>
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/financeiro/cartoes/${c.id}`}
                      className="truncate text-base font-semibold hover:underline"
                    >
                      {c.name}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.name}`}>
                          <EllipsisIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setForm({ card: c })}>
                          <PencilIcon /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void archive(c, !c.archived)}>
                          {c.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}{" "}
                          {c.archived ? "Reativar" : "Arquivar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                          <Trash2Icon /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <span className="text-[13px] text-ink-3">
                    Fecha dia {c.closingDay} · vence dia {c.dueDay}
                  </span>
                  {c.archived ? <Badge className="w-fit">arquivado</Badge> : null}
                </div>
              </div>
              <LimitMeter limit={c.creditLimit} used={c.used} available={c.available} />
              <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
                {[
                  { label: "Fatura atual", inv: c.currentInvoice },
                  { label: "Próxima fatura", inv: c.nextInvoice },
                ].map(({ label, inv }) => (
                  <Link
                    key={label}
                    href={`/financeiro/cartoes/${c.id}/faturas/${inv.referenceMonth}`}
                    className="-m-1 grid gap-0.5 rounded-control p-1 hover:bg-surface-sunken"
                  >
                    <span className="text-xs text-ink-3">
                      {label} · {formatMonth(inv.referenceMonth, "short")}
                    </span>
                    <MoneyText value={inv.total} variant="table" className="text-lg font-medium" />
                    <span className="text-xs text-ink-3">
                      {INVOICE_STATUS_LABELS[inv.status]} · vence {formatDayMonth(inv.dueDate)}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {form ? (
        <CardFormDialog
          open
          onOpenChange={(o) => !o && setForm(null)}
          card={form.card}
          accounts={accounts}
          today={today}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description={
          <p>Só é possível excluir cartões sem compras nem faturas. Com histórico, arquive.</p>
        }
        confirmLabel="Excluir cartão"
        onConfirm={async () => {
          if (deleting && handleActionResult(await deleteCardAction({ id: deleting.id })))
            toast.success("Cartão excluído");
        }}
      />
    </div>
  );
}
