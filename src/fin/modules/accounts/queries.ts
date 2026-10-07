import { fromDbDate, type ISODate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { sumMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { accountRepository as repo } from "./repository";
import type { AccountDTO, AccountsSummary } from "./types";

export async function listAccounts(
  ctx: ServiceContext,
  options: { includeArchived?: boolean; asOf?: ISODate } = {},
): Promise<{ accounts: AccountDTO[]; summary: AccountsSummary }> {
  const [rows, balances, counts, before] = await Promise.all([
    repo.list(prisma, ctx.workspaceId),
    repo.balances(prisma, ctx.workspaceId, options.asOf),
    repo.transactionCounts(prisma, ctx.workspaceId),
    repo.beforeStart(prisma, ctx.workspaceId),
  ]);

  const all: AccountDTO[] = rows.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    institution: a.institution,
    color: a.color,
    initialBalance: toMoneyString(a.initialBalance),
    initialBalanceDate: fromDbDate(a.initialBalanceDate),
    isLiquid: a.isLiquid,
    includeInNetWorth: a.includeInNetWorth,
    archived: a.archivedAt !== null,
    sortOrder: a.sortOrder,
    balance: toMoneyString(balances.get(a.id) ?? ZERO),
    transactionCount: counts.get(a.id) ?? 0,
    beforeStart: before.has(a.id)
      ? { count: before.get(a.id)!.count, earliest: fromDbDate(before.get(a.id)!.earliest) }
      : null,
  }));

  const active = all.filter((a) => !a.archived);
  const summary: AccountsSummary = {
    available: toMoneyString(sumMoney(active.filter((a) => a.isLiquid).map((a) => a.balance))),
    invested: toMoneyString(
      sumMoney(active.filter((a) => a.type === "INVESTMENT").map((a) => a.balance)),
    ),
    netWorthTotal: toMoneyString(
      sumMoney(active.filter((a) => a.includeInNetWorth).map((a) => a.balance)),
    ),
    beforeStartCount: active.reduce((n, a) => n + (a.beforeStart?.count ?? 0), 0),
  };

  return { accounts: options.includeArchived ? all : active, summary };
}

/** Opções para selects de formulários (somente contas ativas). */
export async function listAccountOptions(ctx: ServiceContext) {
  return prisma.account.findMany({
    where: { workspaceId: ctx.workspaceId, archivedAt: null },
    select: { id: true, name: true, type: true, color: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
