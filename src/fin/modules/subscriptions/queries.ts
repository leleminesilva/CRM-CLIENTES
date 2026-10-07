import { addDays, diffInDays, fromDbDate, type ISODate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { sumMoney, toMoney, toMoneyString } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { occurrencesPerYear } from "@fin/modules/recurrences/domain/schedule";

export interface SubscriptionDTO {
  id: string;
  name: string;
  provider: string | null;
  website: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELED";
  amount: string;
  billingLabel: string;
  monthlyCost: string;
  yearlyCost: string;
  nextCharge: ISODate | null;
  daysToNextCharge: number | null;
  paidWith: string | null;
  category: { name: string; icon: string; color: string } | null;
  trialEndsAt: ISODate | null;
  canceledAt: ISODate | null;
}

function billingLabel(frequency: string, interval: number) {
  if (frequency === "YEARLY") return "Anual";
  if (interval === 3) return "Trimestral";
  if (interval === 6) return "Semestral";
  if (interval === 1) return "Mensal";
  return `A cada ${interval} meses`;
}

export async function listSubscriptions(ctx: ServiceContext, today: ISODate) {
  const subs = await prisma.subscription.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: {
      recurrence: {
        include: {
          transactions: {
            where: { deletedAt: null, status: "PENDING", dueDate: { gte: toDbDate(today) } },
            orderBy: { dueDate: "asc" },
            take: 1,
            select: { dueDate: true },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  const [categories, accounts, cards] = await Promise.all([
    prisma.category.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true, icon: true, color: true },
    }),
    prisma.account.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
    }),
    prisma.creditCard.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
    }),
  ]);
  const items: SubscriptionDTO[] = subs.map((s) => {
    const r = s.recurrence;
    const perYear = occurrencesPerYear(r);
    const yearly = toMoney(r.amount).times(perYear);
    const next = r.transactions[0] ? fromDbDate(r.transactions[0].dueDate) : null;
    const cat = categories.find((c) => c.id === r.categoryId);
    return {
      id: s.id,
      name: s.name,
      provider: s.provider,
      website: s.website,
      status: s.status,
      amount: toMoneyString(r.amount),
      billingLabel: billingLabel(r.frequency, r.intervalCount),
      monthlyCost: toMoneyString(yearly.dividedBy(12)),
      yearlyCost: toMoneyString(yearly),
      nextCharge: s.status === "ACTIVE" ? next : null,
      daysToNextCharge: s.status === "ACTIVE" && next ? diffInDays(next, today) : null,
      paidWith:
        cards.find((c) => c.id === r.creditCardId)?.name ??
        accounts.find((a) => a.id === r.accountId)?.name ??
        null,
      category: cat ? { name: cat.name, icon: cat.icon, color: cat.color } : null,
      trialEndsAt: s.trialEndsAt ? fromDbDate(s.trialEndsAt) : null,
      canceledAt: s.canceledAt ? fromDbDate(s.canceledAt) : null,
    };
  });
  const active = items.filter((i) => i.status === "ACTIVE");
  return {
    items,
    monthlyTotal: toMoneyString(sumMoney(active.map((i) => i.monthlyCost))),
    yearlyTotal: toMoneyString(sumMoney(active.map((i) => i.yearlyCost))),
    renewingSoon: active.filter(
      (i) => i.billingLabel === "Anual" && i.nextCharge && i.nextCharge <= addDays(today, 30),
    ),
  };
}
