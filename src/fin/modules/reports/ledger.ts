import type { Prisma } from "@prisma/client";
import { fromDbDate, type ISODate, monthKeyOf, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { displayStatus } from "@fin/modules/transactions/domain/status";
import type { LedgerRow, ReportFilters } from "./types";

/**
 * Lançamentos que entram nos relatórios (regra R0): pelo vencimento; sem transferências,
 * pagamentos de fatura e ajustes de saldo; cancelados só aparecem se o filtro pedir.
 */
export async function loadLedger(
  ctx: ServiceContext,
  f: ReportFilters,
  today: ISODate,
): Promise<LedgerRow[]> {
  const categoryIds = f.categoryId
    ? [
        f.categoryId,
        ...(
          await prisma.category.findMany({
            where: { parentId: f.categoryId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        ).map((c) => c.id),
      ]
    : null;
  const statusWhere: Prisma.TransactionWhereInput =
    f.status === "SETTLED"
      ? { status: "SETTLED" }
      : f.status === "PENDING"
        ? { status: "PENDING", dueDate: { gte: toDbDate(today), lte: toDbDate(f.to) } }
        : f.status === "OVERDUE"
          ? { status: "PENDING", dueDate: { lt: toDbDate(today) } }
          : f.status === "CANCELED"
            ? { status: "CANCELED" }
            : { status: { not: "CANCELED" } };
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      isBalanceAdjustment: false,
      type:
        f.type === "INCOME"
          ? "INCOME"
          : f.type === "EXPENSE"
            ? { in: ["EXPENSE", "REFUND"] }
            : { in: ["INCOME", "EXPENSE", "REFUND"] },
      AND: [{ dueDate: { gte: toDbDate(f.from), lte: toDbDate(f.to) } }, statusWhere],
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(f.accountId ? { accountId: f.accountId } : {}),
      ...(f.cardId ? { creditCardId: f.cardId } : {}),
    },
    select: {
      type: true,
      status: true,
      amount: true,
      dueDate: true,
      nature: true,
      installmentPlanId: true,
      category: {
        select: {
          id: true,
          name: true,
          incomeClass: true,
          parent: { select: { id: true, name: true } },
        },
      },
      account: { select: { name: true } },
      creditCard: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => {
    const date = fromDbDate(r.dueDate);
    const group = r.category?.parent ?? r.category;
    const amount = toMoney(r.amount);
    return {
      date,
      month: monthKeyOf(date),
      kind: r.type === "INCOME" ? "INCOME" : "EXPENSE",
      amount: r.type === "REFUND" ? amount.negated() : amount,
      settled: r.status === "SETTLED",
      displayStatus: displayStatus(r.status, date, today),
      nature: r.nature,
      groupId: group?.id ?? null,
      groupName: group?.name ?? "Sem categoria",
      categoryName: r.category?.name ?? "Sem categoria",
      incomeClass: r.category?.incomeClass ?? null,
      accountName: r.account?.name ?? null,
      cardName: r.creditCard?.name ?? null,
      isInstallment: r.installmentPlanId !== null,
    };
  });
}
