"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BanknoteIcon,
  BriefcaseBusinessIcon,
  EllipsisIcon,
  LandmarkIcon,
  PencilIcon,
  PiggyBankIcon,
  PlusIcon,
  ReceiptTextIcon,
  TicketIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { BalanceStartNotice } from "./balance-start-notice";
import { SortableList } from "@fin/components/shared/sortable-list";
import { Badge } from "@fin/components/ui/badge";
import { Button } from "@fin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import type { AccountType } from "@prisma/client";
import { handleActionResult } from "@fin/lib/action-result";
import { cn } from "@fin/lib/cn";
import { formatDate, type ISODate } from "@fin/lib/dates";
import { deleteAccountAction, reorderAccountsAction, setAccountArchivedAction } from "../actions";
import { ACCOUNT_TYPE_LABELS, type AccountDTO, type AccountsSummary } from "../types";
import { AccountFormDialog } from "./account-form-dialog";

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  CHECKING: LandmarkIcon,
  SAVINGS: PiggyBankIcon,
  WALLET: WalletIcon,
  INVESTMENT: TrendingUpIcon,
  BENEFIT: TicketIcon,
  OTHER: BriefcaseBusinessIcon,
};

interface AccountsViewProps {
  accounts: AccountDTO[];
  summary: AccountsSummary;
  showArchived: boolean;
  today: ISODate;
}

export function AccountsView({ accounts, summary, showArchived, today }: AccountsViewProps) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountDTO | undefined>();
  const [deleting, setDeleting] = React.useState<AccountDTO | undefined>();

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  async function setArchived(account: AccountDTO, value: boolean) {
    const result = await setAccountArchivedAction({ id: account.id, archived: value });
    if (handleActionResult(result))
      toast.success(value ? `“${account.name}” arquivada` : `“${account.name}” reativada`);
  }

  async function reorder(ids: string[]) {
    return handleActionResult(await reorderAccountsAction({ orderedIds: ids }));
  }

  function row(account: AccountDTO, handle: React.ReactNode) {
    const Icon = TYPE_ICONS[account.type];
    const negative = account.balance.startsWith("-");
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-3 sm:px-4",
          account.archived && "bg-surface-sunken/50",
        )}
      >
        {handle}
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-card border border-line bg-surface-sunken"
          style={
            account.color
              ? { borderColor: account.color, boxShadow: `inset 3px 0 0 ${account.color}` }
              : undefined
          }
        >
          <Icon className="size-[18px] text-ink-2" strokeWidth={1.75} />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={`/financeiro/contas/${account.id}`} className="truncate font-medium hover:underline">
              {account.name}
            </Link>
            {!account.isLiquid && !account.archived ? (
              <Badge variant="outline" className="max-sm:hidden">
                fora do disponível
              </Badge>
            ) : null}
            {account.archived ? <Badge>arquivada</Badge> : null}
          </div>
          <span className="truncate text-[13px] text-ink-3">
            {ACCOUNT_TYPE_LABELS[account.type]}
            {account.institution ? ` · ${account.institution}` : ""}
          </span>
        </div>
        <div className="grid justify-items-end gap-0.5 text-right">
          <MoneyText
            value={account.balance}
            variant="table"
            tone={negative ? "critical" : "default"}
            className="text-[15px] font-medium"
          />
          <span className="text-xs text-ink-3">
            {account.transactionCount === 0
              ? `saldo inicial em ${formatDate(account.initialBalanceDate)}`
              : `${account.transactionCount} ${account.transactionCount === 1 ? "lançamento" : "lançamentos"}`}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${account.name}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/financeiro/contas/${account.id}`}>
                <ReceiptTextIcon /> Ver extrato
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setEditing(account);
                setFormOpen(true);
              }}
            >
              <PencilIcon /> Editar
            </DropdownMenuItem>
            {account.archived ? (
              <DropdownMenuItem onSelect={() => void setArchived(account, false)}>
                <ArchiveRestoreIcon /> Reativar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => void setArchived(account, true)}>
                <ArchiveIcon /> Arquivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setDeleting(account)}>
              <Trash2Icon /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="title-page">Contas</h1>
          <p className="text-sm text-ink-2">
            Saldos calculados a partir dos lançamentos pagos e recebidos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" asChild>
            <Link href={showArchived ? "/financeiro/contas" : "/financeiro/contas?arquivadas=1"} replace scroll={false}>
              {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <PlusIcon /> Nova conta
          </Button>
        </div>
      </div>

      {active.length > 0 ? (
        <Panel className="grid gap-6 p-5 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
          <div className="grid gap-1">
            <span className="text-[13px] text-ink-2">Saldo disponível</span>
            <MoneyText
              value={summary.available}
              variant="hero"
              tone={summary.available.startsWith("-") ? "critical" : "default"}
            />
            <span className="text-xs text-ink-3">
              Soma das contas marcadas como disponíveis ({active.filter((a) => a.isLiquid).length})
            </span>
          </div>
          <div className="grid gap-1 sm:border-l sm:border-line sm:pl-6">
            <span className="text-[13px] text-ink-2">Investido</span>
            <MoneyText value={summary.invested} variant="kpi" />
          </div>
          <div className="grid gap-1 sm:border-l sm:border-line sm:pl-6">
            <span className="text-[13px] text-ink-2">Em contas, no patrimônio</span>
            <MoneyText value={summary.netWorthTotal} variant="kpi" />
          </div>
        </Panel>
      ) : null}

      <BalanceStartNotice accounts={active} />

      <Panel>
        {active.length === 0 ? (
          <EmptyState
            icon={BanknoteIcon}
            title="Cadastre sua primeira conta"
            description="Conta corrente, poupança, carteira, corretora ou vale-refeição. Informe o saldo de hoje e o sistema acompanha daí em diante."
            action={
              <Button onClick={openCreate}>
                <PlusIcon /> Nova conta
              </Button>
            }
          />
        ) : (
          <SortableList
            items={active}
            getLabel={(a) => a.name}
            onReorder={reorder}
            renderItem={row}
            className="divide-y divide-line"
          />
        )}
      </Panel>

      {showArchived ? (
        <section className="grid gap-2">
          <h2 className="title-section">Arquivadas</h2>
          <Panel>
            {archived.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">
                Nenhuma conta arquivada.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {archived.map((a) => (
                  <li key={a.id}>{row(a, <span className="inline-block w-6" />)}</li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      ) : null}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
        today={today}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description={
          deleting && deleting.transactionCount > 0 ? (
            <p>
              Esta conta tem {deleting.transactionCount} lançamentos e não pode ser excluída.
              Arquive-a para escondê-la sem perder o histórico.
            </p>
          ) : (
            <p>A conta será removida definitivamente. Esta ação não pode ser desfeita.</p>
          )
        }
        confirmLabel={
          deleting && deleting.transactionCount > 0 ? "Arquivar conta" : "Excluir conta"
        }
        destructive={!(deleting && deleting.transactionCount > 0)}
        onConfirm={async () => {
          if (!deleting) return;
          if (deleting.transactionCount > 0) {
            await setArchived(deleting, true);
            return;
          }
          const result = await deleteAccountAction({ id: deleting.id });
          if (handleActionResult(result)) toast.success(`“${deleting.name}” excluída`);
        }}
      />
    </div>
  );
}
