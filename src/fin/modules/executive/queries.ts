import { addMonthsToKey, type ISODate, monthKeyOf } from "@fin/lib/dates";
import type { ServiceContext } from "@fin/lib/permissions";
import { sumMoney, toMoney, toMoneyString } from "@fin/lib/money";
import { listAccounts } from "@fin/modules/accounts/queries";
import { monthlySeries, spendingByCategory } from "@fin/modules/dashboard/queries";
import { forecast } from "@fin/modules/forecast/queries";
import { getInsights } from "@fin/modules/insights/rules";
import { netWorthAsOf } from "@fin/modules/net-worth/queries";
import { monthTotals } from "@fin/modules/transactions/queries";
import { prisma } from "@fin/lib/db";

export interface Growth {
  recent: string;
  previous: string;
  change: string | null;
  /** Janela recente e anterior (meses completos, o mês em curso não entra). */
  recentFrom: string;
  recentTo: string;
  previousFrom: string;
  previousTo: string;
  /** Só compara quando as duas janelas têm lançamentos. */
  comparable: boolean;
}

/** Média dos 3 meses completos mais recentes contra os 3 anteriores (variação). */
function growth(points: { month: string; value: string }[]): Growth {
  const recentPts = points.slice(-3);
  const previousPts = points.slice(0, 3);
  const recent = sumMoney(recentPts.map((p) => p.value)).dividedBy(3);
  const previous = sumMoney(previousPts.map((p) => p.value)).dividedBy(3);
  const has = (pts: { value: string }[]) => pts.some((p) => !toMoney(p.value).isZero());
  const comparable = has(recentPts) && has(previousPts);
  return {
    recent: toMoneyString(recent),
    previous: toMoneyString(previous),
    change:
      comparable && previous.greaterThan(0)
        ? recent.minus(previous).dividedBy(previous).toFixed(4)
        : null,
    recentFrom: recentPts[0]!.month,
    recentTo: recentPts.at(-1)!.month,
    previousFrom: previousPts[0]!.month,
    previousTo: previousPts.at(-1)!.month,
    comparable,
  };
}

/** As dez perguntas da visão executiva (R-executivo), respondidas com os mesmos números do resto do app. */
export async function executiveBrief(ctx: ServiceContext, today: ISODate) {
  const month = monthKeyOf(today);
  const [accounts, totals, netWorth, series, categories, f, insights, recurring] =
    await Promise.all([
      listAccounts(ctx),
      monthTotals(ctx, month, today),
      netWorthAsOf(ctx, today),
      monthlySeries(ctx, addMonthsToKey(month, -1), 6),
      spendingByCategory(ctx, month),
      forecast(ctx, today, 12, "realistic"),
      getInsights(ctx, today),
      prisma.recurrence.count({
        where: { workspaceId: ctx.workspaceId, deletedAt: null, pausedAt: null },
      }),
    ]);
  const at = (i: number) => f.months[i] ?? f.months.at(-1)!;
  return {
    month,
    available: accounts.summary.available,
    beforeStartCount: accounts.summary.beforeStartCount,
    toReceive: totals.income.pending,
    toPay: totals.expense.pending,
    overdueToPay: totals.expense.overdue,
    leftover: totals.result,
    endOfMonth: at(0).closing,
    liabilities: netWorth.liabilitiesTotal,
    netWorth: netWorth.netWorth,
    incomeGrowth: growth(series.map((p) => ({ month: p.month, value: p.income }))),
    expenseGrowth: growth(series.map((p) => ({ month: p.month, value: p.expense }))),
    /** Sem recorrências, a projeção não sabe do salário nem das contas fixas futuras. */
    recurringCount: recurring,
    topCategory: categories[0] ?? null,
    expenseTotal: totals.expense.total,
    projection: [3, 6, 12].map((n) => ({
      months: n,
      balance: at(n - 1).closing,
      negative: toMoney(at(n - 1).closing).isNegative(),
    })),
    firstNegative: f.firstNegative,
    insights: insights.slice(0, 4),
  };
}
