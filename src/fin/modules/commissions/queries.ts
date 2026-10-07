import {
  addMonthsToKey,
  fromDbDate,
  type ISODate,
  type MonthKey,
  monthKeyOf,
  monthRange,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { type Money, sumMoney, toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { displayStatus, type DisplayStatus } from "@fin/modules/transactions/domain/status";

export interface CommissionDTO {
  id: string;
  transactionId: string;
  clientName: string;
  saleDescription: string;
  saleAmount: string;
  ratePercent: string;
  amount: string;
  isAmountOverridden: boolean;
  saleDate: ISODate;
  expectedDate: ISODate;
  receivedAt: ISODate | null;
  status: DisplayStatus;
  account: { id: string; name: string } | null;
  notes: string | null;
}

async function rows(ctx: ServiceContext, where: object = {}) {
  return prisma.commission.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      transaction: { deletedAt: null },
      ...where,
    },
    include: { transaction: { include: { account: { select: { id: true, name: true } } } } },
    orderBy: [{ transaction: { dueDate: "desc" } }, { createdAt: "desc" }],
  });
}

export async function listCommissions(
  ctx: ServiceContext,
  today: ISODate,
  filter: { month?: MonthKey } = {},
): Promise<CommissionDTO[]> {
  const range = filter.month ? monthRange(filter.month) : null;
  const found = await rows(
    ctx,
    range
      ? {
          transaction: {
            deletedAt: null,
            dueDate: { gte: toDbDate(range.start), lte: toDbDate(range.end) },
          },
        }
      : {},
  );
  return found.map((c) => {
    const t = c.transaction;
    return {
      id: c.id,
      transactionId: t.id,
      clientName: c.clientName,
      saleDescription: c.saleDescription,
      saleAmount: toMoneyString(c.saleAmount),
      ratePercent: c.ratePercent.toString(),
      amount: toMoneyString(t.amount),
      isAmountOverridden: c.isAmountOverridden,
      saleDate: fromDbDate(c.saleDate),
      expectedDate: fromDbDate(t.dueDate),
      receivedAt: t.settledAt ? fromDbDate(t.settledAt) : null,
      status: displayStatus(t.status, fromDbDate(t.dueDate), today),
      account: t.account,
      notes: c.notes,
    };
  });
}

export interface CommissionStats {
  /** Previstas para o mês (todas, exceto canceladas). */
  expected: string;
  received: string;
  pending: string;
  /** Atrasadas de qualquer mês. */
  overdue: string;
  overdueCount: number;
  /** Média mensal (por mês da previsão) dos últimos 6 e 12 meses completos. */
  average6: string;
  average12: string;
  byMonth: { month: MonthKey; total: string; received: string }[];
  byClient: { client: string; total: string; count: number }[];
}

/** Painel de comissões (R6). */
export async function commissionStats(
  ctx: ServiceContext,
  month: MonthKey,
  today: ISODate,
): Promise<CommissionStats> {
  const all = await rows(ctx);
  const valid = all.filter((c) => c.transaction.status !== "CANCELED");
  const inMonth = valid.filter((c) => monthKeyOf(fromDbDate(c.transaction.dueDate)) === month);
  const sum = (list: typeof valid) => sumMoney(list.map((c) => c.transaction.amount));
  const overdueList = valid.filter(
    (c) => c.transaction.status === "PENDING" && fromDbDate(c.transaction.dueDate) < today,
  );

  const currentMonth = monthKeyOf(today);
  const months = Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentMonth, i - 11));
  const byMonthMap = new Map<string, { total: Money; received: Money }>();
  for (const c of valid) {
    const key = monthKeyOf(fromDbDate(c.transaction.dueDate));
    const cur = byMonthMap.get(key) ?? { total: ZERO, received: ZERO };
    cur.total = cur.total.plus(toMoney(c.transaction.amount));
    if (c.transaction.status === "SETTLED")
      cur.received = cur.received.plus(toMoney(c.transaction.amount));
    byMonthMap.set(key, cur);
  }
  const completed = (n: number) =>
    Array.from({ length: n }, (_, i) => addMonthsToKey(currentMonth, -(i + 1)));
  const avg = (n: number) =>
    sumMoney(completed(n).map((m) => byMonthMap.get(m)?.total ?? ZERO)).dividedBy(n);

  const clients = new Map<string, { total: Money; count: number }>();
  for (const c of valid.filter(
    (c) => fromDbDate(c.transaction.dueDate) >= `${addMonthsToKey(currentMonth, -11)}-01`,
  )) {
    const cur = clients.get(c.clientName) ?? { total: ZERO, count: 0 };
    clients.set(c.clientName, {
      total: cur.total.plus(toMoney(c.transaction.amount)),
      count: cur.count + 1,
    });
  }

  return {
    expected: toMoneyString(sum(inMonth)),
    received: toMoneyString(sum(inMonth.filter((c) => c.transaction.status === "SETTLED"))),
    pending: toMoneyString(sum(inMonth.filter((c) => c.transaction.status === "PENDING"))),
    overdue: toMoneyString(sum(overdueList)),
    overdueCount: overdueList.length,
    average6: toMoneyString(avg(6)),
    average12: toMoneyString(avg(12)),
    byMonth: months.map((m) => ({
      month: m,
      total: toMoneyString(byMonthMap.get(m)?.total ?? ZERO),
      received: toMoneyString(byMonthMap.get(m)?.received ?? ZERO),
    })),
    byClient: [...clients.entries()]
      .map(([client, v]) => ({ client, total: toMoneyString(v.total), count: v.count }))
      .sort((a, b) => toMoney(b.total).comparedTo(toMoney(a.total)))
      .slice(0, 8),
  };
}
