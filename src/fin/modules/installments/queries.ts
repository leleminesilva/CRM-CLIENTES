import { addMonthsToKey, fromDbDate, type ISODate, type MonthKey, monthKeyOf } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { sumMoney, toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { finishCompletedPlans } from "./service";

export interface PlanDTO {
  id: string;
  description: string;
  merchant: string | null;
  category: { name: string; icon: string; color: string } | null;
  card: { id: string; name: string } | null;
  account: { name: string } | null;
  totalAmount: string;
  cashPrice: string | null;
  /** Juros embutidos = total − à vista. */
  interest: string | null;
  installmentCount: number;
  installmentAmount: string;
  paidCount: number;
  remainingCount: number;
  /** Saldo devedor = soma das parcelas pendentes. */
  outstanding: string;
  purchaseDate: ISODate;
  nextDueDate: ISODate | null;
  lastDueDate: ISODate | null;
  status: "ACTIVE" | "FINISHED" | "SETTLED_EARLY" | "CANCELED";
}

export async function listPlans(
  ctx: ServiceContext,
  opts: { includeFinished?: boolean; creditCardId?: string } = {},
): Promise<PlanDTO[]> {
  await finishCompletedPlans(ctx.workspaceId);
  const plans = await prisma.installmentPlan.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      ...(opts.includeFinished ? {} : { status: "ACTIVE" }),
      ...(opts.creditCardId ? { creditCardId: opts.creditCardId } : {}),
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      creditCard: { select: { id: true, name: true } },
      account: { select: { name: true } },
      installments: {
        where: { deletedAt: null },
        select: { status: true, amount: true, dueDate: true },
        orderBy: { installmentNumber: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { purchaseDate: "desc" }],
  });
  return plans.map((p) => {
    const pending = p.installments.filter((i) => i.status === "PENDING");
    const settled = p.installments.filter((i) => i.status === "SETTLED").length;
    const total = toMoney(p.totalAmount);
    return {
      id: p.id,
      description: p.description,
      merchant: p.merchant,
      category: p.category,
      card: p.creditCard,
      account: p.account,
      totalAmount: toMoneyString(total),
      cashPrice: p.cashPrice ? toMoneyString(p.cashPrice) : null,
      interest: p.cashPrice ? toMoneyString(total.minus(toMoney(p.cashPrice))) : null,
      installmentCount: p.installmentCount,
      installmentAmount: toMoneyString(total.dividedBy(p.installmentCount).toDecimalPlaces(2)),
      paidCount: p.priorPaidCount + settled,
      remainingCount: pending.length,
      outstanding: toMoneyString(sumMoney(pending.map((i) => i.amount))),
      purchaseDate: fromDbDate(p.purchaseDate),
      nextDueDate: pending[0] ? fromDbDate(pending[0].dueDate) : null,
      lastDueDate: p.installments.at(-1) ? fromDbDate(p.installments.at(-1)!.dueDate) : null,
      status: p.status,
    };
  });
}

/** Quanto as parcelas pesam em cada um dos próximos meses (pelo vencimento). */
export async function futureImpact(
  ctx: ServiceContext,
  today: ISODate,
  months = 12,
): Promise<{ month: MonthKey; amount: string }[]> {
  const start = monthKeyOf(today);
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      status: "PENDING",
      installmentPlanId: { not: null },
    },
    select: { amount: true, dueDate: true },
  });
  const byMonth = new Map<string, ReturnType<typeof toMoney>>();
  for (const r of rows) {
    const key = monthKeyOf(fromDbDate(r.dueDate));
    byMonth.set(key, (byMonth.get(key) ?? ZERO).plus(toMoney(r.amount)));
  }
  return Array.from({ length: months }, (_, i) => {
    const month = addMonthsToKey(start, i);
    return { month, amount: toMoneyString(byMonth.get(month) ?? ZERO) };
  });
}
