import { Prisma } from "@prisma/client";
import { addMonthsToKey, monthKeyOf, monthRange, toDbDate, type ISODate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { ratio, toMoney, toMoneyString } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { spendingByCategory } from "@fin/modules/dashboard/queries";
import { netWorthAsOf } from "@fin/modules/net-worth/queries";
import { monthTotals } from "@fin/modules/transactions/queries";
import { buildChecklist } from "./domain/checklist";
import type { ClosingHistoryItem, ClosingReview, ClosingSummary } from "./types";

const OPEN_LEDGER = Prisma.sql`status <> 'CANCELED' AND deleted_at IS NULL AND is_balance_adjustment = false AND type IN ('INCOME', 'EXPENSE')`;

/** Totais do mês como estão agora: receitas, despesas, resultado, patrimônio e maior categoria. */
export async function liveSummary(
  ctx: ServiceContext,
  month: string,
  today: ISODate,
): Promise<ClosingSummary> {
  const { end } = monthRange(month);
  const [totals, categories, worth] = await Promise.all([
    monthTotals(ctx, month, today),
    spendingByCategory(ctx, month),
    netWorthAsOf(ctx, end < today ? end : today),
  ]);
  const income = toMoney(totals.income.total);
  const result = toMoney(totals.result);
  const top = categories[0];
  return {
    income: totals.income.total,
    expense: totals.expense.total,
    result: totals.result,
    savingsRate: income.isZero() ? null : (ratio(result, income)?.toFixed(4) ?? null),
    netWorth: worth.netWorth,
    topCategory: top ? { name: top.name, amount: top.amount } : null,
  };
}

export async function getClosingReview(
  ctx: ServiceContext,
  month: string,
  today: ISODate,
): Promise<ClosingReview> {
  const { start, end } = monthRange(month);
  const ws = ctx.workspaceId;
  const [pending, uncategorized, invoices, commissions, closed, previous] = await Promise.all([
    prisma.$queryRaw<{ n: number; overdue: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE due_date < ${toDbDate(today)})::int AS overdue
      FROM fin_transactions
      WHERE workspace_id = ${ws}::uuid AND ${OPEN_LEDGER} AND status = 'PENDING'
        AND due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}`),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM fin_transactions
      WHERE workspace_id = ${ws}::uuid AND ${OPEN_LEDGER} AND category_id IS NULL
        AND due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}`),
    prisma.creditCardInvoice.count({
      where: {
        workspaceId: ws,
        status: { not: "PAID" },
        dueDate: { gte: toDbDate(start), lte: toDbDate(end) },
        transactions: { some: { deletedAt: null } },
      },
    }),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM fin_commissions c JOIN fin_transactions t ON t.id = c.transaction_id
      WHERE c.workspace_id = ${ws}::uuid AND c.deleted_at IS NULL AND t.deleted_at IS NULL
        AND t.status = 'PENDING' AND t.due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}`),
    prisma.monthClose.findUnique({ where: { workspaceId_month: { workspaceId: ws, month } } }),
    monthTotals(ctx, addMonthsToKey(month, -1), today),
  ]);
  const checklist = buildChecklist({
    month,
    currentMonth: monthKeyOf(today),
    pending: { count: pending[0]?.n ?? 0, overdue: pending[0]?.overdue ?? 0 },
    uncategorized: uncategorized[0]?.n ?? 0,
    openInvoices: invoices,
    pendingCommissions: commissions[0]?.n ?? 0,
  });
  return {
    month,
    checklist,
    summary: closed
      ? (closed.summary as unknown as ClosingSummary)
      : await liveSummary(ctx, month, today),
    previous: {
      income: previous.income.total,
      expense: previous.expense.total,
      result: previous.result,
    },
    closed: closed ? { closedAt: closed.closedAt.toISOString(), notes: closed.notes } : null,
  };
}

export async function listClosings(ctx: ServiceContext): Promise<ClosingHistoryItem[]> {
  const rows = await prisma.monthClose.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { month: "desc" },
    take: 36,
  });
  return rows.map((r) => {
    const s = r.summary as unknown as ClosingSummary;
    return {
      month: r.month,
      closedAt: r.closedAt.toISOString(),
      result: toMoneyString(s.result),
      netWorth: toMoneyString(s.netWorth),
    };
  });
}

/** Último mês encerrado ainda sem fechamento (para lembrar na tela inicial), ou null. */
export async function pendingClosingMonth(
  ctx: ServiceContext,
  today: ISODate,
): Promise<string | null> {
  const previous = addMonthsToKey(monthKeyOf(today), -1);
  const done = await prisma.monthClose.findUnique({
    where: { workspaceId_month: { workspaceId: ctx.workspaceId, month: previous } },
    select: { id: true },
  });
  if (done) return null;
  // Só vale lembrar quando o mês passado teve movimento.
  const { start, end } = monthRange(previous);
  const used = await prisma.transaction.count({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      dueDate: { gte: toDbDate(start), lte: toDbDate(end) },
    },
  });
  return used > 0 ? previous : null;
}
