import { addMonthsToKey, lastDayOfMonth, type ISODate, monthKeyOf, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import type { ServiceContext } from "@fin/lib/permissions";
import { netWorthAsOf } from "./queries";

/**
 * Grava a fotografia do patrimônio (idempotente por workspace/período/data). Mensal: fim de cada mês
 * dos últimos 24 meses ainda sem fotografia + a de hoje, que é refeita a cada execução.
 */
export async function captureSnapshots(ctx: ServiceContext, today: ISODate): Promise<number> {
  const current = monthKeyOf(today);
  const targets: { period: "DAILY" | "MONTHLY"; date: ISODate }[] = [
    { period: "DAILY", date: today },
  ];
  const existing = new Set(
    (
      await prisma.financialSnapshot.findMany({
        where: { workspaceId: ctx.workspaceId, period: "MONTHLY" },
        select: { date: true },
      })
    ).map((s) => s.date.toISOString().slice(0, 10)),
  );
  for (let i = 1; i <= 24; i++) {
    const date = lastDayOfMonth(addMonthsToKey(current, -i));
    if (!existing.has(date)) targets.push({ period: "MONTHLY", date });
  }
  for (const t of targets) {
    const s = await netWorthAsOf(ctx, t.date);
    const data = {
      liquidBalance: s.liquid,
      investedBalance: s.invested,
      totalAssets: s.assetsTotal,
      totalLiabilities: s.liabilitiesTotal,
      netWorth: s.netWorth,
      incomeTotal: "0",
      expenseTotal: "0",
      breakdown: JSON.parse(
        JSON.stringify({ assets: s.assets, liabilities: s.liabilities }),
      ) as object,
    };
    await prisma.financialSnapshot.upsert({
      where: {
        workspaceId_period_date: {
          workspaceId: ctx.workspaceId,
          period: t.period,
          date: toDbDate(t.date),
        },
      },
      create: { workspaceId: ctx.workspaceId, period: t.period, date: toDbDate(t.date), ...data },
      update: data,
    });
  }
  return targets.length;
}
