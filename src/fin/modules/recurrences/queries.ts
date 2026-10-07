import { fromDbDate, type ISODate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, toMoneyString } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { occurrencesPerYear } from "./domain/schedule";
import type { Frequency, DayRule } from "./domain/schedule";

export interface RecurrenceDTO {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: string;
  isEstimatedAmount: boolean;
  frequency: Frequency;
  intervalCount: number;
  dayRule: DayRule;
  dayOfMonth: number | null;
  nature: "FIXED" | "VARIABLE" | null;
  category: { name: string; icon: string; color: string } | null;
  account: { name: string } | null;
  paused: boolean;
  startDate: ISODate;
  endDate: ISODate | null;
  nextDueDate: ISODate | null;
  /** Equivalente mensal (valor × ocorrências por ano ÷ 12). */
  monthlyEquivalent: string;
  yearlyTotal: string;
  isSubscription: boolean;
}

/** Séries ativas (receitas ou despesas), com a próxima ocorrência pendente. */
export async function listRecurrences(
  ctx: ServiceContext,
  filter: { type: "INCOME" | "EXPENSE"; nature?: "FIXED" | "VARIABLE" },
  today: ISODate,
): Promise<RecurrenceDTO[]> {
  const rows = await prisma.recurrence.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      type: filter.type,
      ...(filter.nature ? { nature: filter.nature } : {}),
    },
    include: {
      subscription: { select: { id: true } },
      transactions: {
        where: { deletedAt: null, status: "PENDING", dueDate: { gte: toDbDate(today) } },
        orderBy: { dueDate: "asc" },
        take: 1,
        select: { dueDate: true, amount: true },
      },
    },
    orderBy: [{ pausedAt: "asc" }, { description: "asc" }],
  });
  const categories = await prisma.category.findMany({
    where: { id: { in: rows.map((r) => r.categoryId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true, icon: true, color: true },
  });
  const accounts = await prisma.account.findMany({
    where: { id: { in: rows.map((r) => r.accountId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true },
  });
  return rows.map((r) => {
    const perYear = occurrencesPerYear(r);
    const yearly = toMoney(r.amount).times(perYear);
    const cat = categories.find((c) => c.id === r.categoryId);
    return {
      id: r.id,
      type: r.type === "INCOME" ? "INCOME" : "EXPENSE",
      description: r.description,
      amount: toMoneyString(r.amount),
      isEstimatedAmount: r.isEstimatedAmount,
      frequency: r.frequency,
      intervalCount: r.intervalCount,
      dayRule: r.dayRule,
      dayOfMonth: r.dayOfMonth,
      nature: r.nature,
      category: cat ? { name: cat.name, icon: cat.icon, color: cat.color } : null,
      account: accounts.find((a) => a.id === r.accountId) ?? null,
      paused: r.pausedAt !== null,
      startDate: fromDbDate(r.startDate),
      endDate: r.endDate ? fromDbDate(r.endDate) : null,
      nextDueDate: r.transactions[0] ? fromDbDate(r.transactions[0].dueDate) : null,
      monthlyEquivalent: toMoneyString(yearly.dividedBy(12)),
      yearlyTotal: toMoneyString(yearly),
      isSubscription: r.subscription !== null,
    };
  });
}
