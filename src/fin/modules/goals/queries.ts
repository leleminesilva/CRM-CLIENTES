import { Prisma } from "@prisma/client";
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
import { sumMoney, toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { accountRepository } from "@fin/modules/accounts/repository";
import { projectGoal, reserveCoverage } from "./domain/projection";

export interface GoalDTO {
  id: string;
  name: string;
  kind: "EMERGENCY_FUND" | "SAVINGS" | "PURCHASE" | "INVESTMENT" | "DEBT_PAYOFF" | "OTHER";
  status: "ACTIVE" | "PAUSED" | "ACHIEVED" | "ARCHIVED";
  color: string | null;
  notes: string | null;
  target: string;
  current: string;
  initial: string;
  linkedAccount: { id: string; name: string } | null;
  targetMonth: MonthKey | null;
  percent: number;
  remaining: string;
  achieved: boolean;
  monthlyPace: string;
  etaMonth: MonthKey | null;
  requiredMonthly: string | null;
  onTrack: boolean | null;
  contributions: { id: string; amount: string; date: ISODate; notes: string | null }[];
}

/** Custo mensal médio: despesas pagas nos últimos 6 meses completos (R9), sem transferências, faturas e ajustes. */
export async function averageMonthlyCost(
  ctx: ServiceContext,
  today: ISODate,
  opts: { essentialOnly?: boolean } = {},
) {
  const end = monthRange(addMonthsToKey(monthKeyOf(today), -1)).end;
  const start = monthRange(addMonthsToKey(monthKeyOf(today), -6)).start;
  const rows = await prisma.$queryRaw<{ month: string; total: string }[]>(Prisma.sql`
    SELECT to_char(t.due_date, 'YYYY-MM') AS month,
      SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE -t.amount END)::text AS total
    FROM fin_transactions t
    LEFT JOIN fin_categories c ON c.id = t.category_id
    LEFT JOIN fin_categories g ON g.id = c.parent_id
    WHERE t.workspace_id = ${ctx.workspaceId}::uuid AND t.deleted_at IS NULL AND t.status = 'SETTLED'
      AND t.type IN ('EXPENSE', 'REFUND') AND t.is_balance_adjustment = false
      AND t.due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}
      ${opts.essentialOnly ? Prisma.sql`AND (c.is_essential OR g.is_essential)` : Prisma.empty}
    GROUP BY 1`);
  if (rows.length === 0) return { average: ZERO, months: 0 };
  const total = sumMoney(rows.map((r) => r.total));
  return { average: total.dividedBy(rows.length), months: rows.length };
}

export async function listGoals(
  ctx: ServiceContext,
  today: ISODate,
  opts: { includeArchived?: boolean } = {},
): Promise<GoalDTO[]> {
  const goals = await prisma.goal.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(opts.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    include: {
      linkedAccount: { select: { id: true, name: true } },
      contributions: { orderBy: { date: "desc" } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const month = monthKeyOf(today);
  const threeMonthsAgo = addMonthsToKey(month, -3);
  const [balancesNow, balancesThen] = await Promise.all([
    accountRepository.balances(prisma, ctx.workspaceId),
    accountRepository.balances(
      prisma,
      ctx.workspaceId,
      monthRange(addMonthsToKey(threeMonthsAgo, 0)).start,
    ),
  ]);
  const since = toDbDate(monthRange(threeMonthsAgo).start);
  return goals.map((g) => {
    const linked = g.linkedAccountId;
    const contributed = sumMoney(g.contributions.map((c) => c.amount));
    const current = linked
      ? (balancesNow.get(linked) ?? ZERO)
      : toMoney(g.initialAmount).plus(contributed);
    const recent = g.contributions.filter((c) => c.date >= since);
    const pace = linked
      ? (balancesNow.get(linked) ?? ZERO).minus(balancesThen.get(linked) ?? ZERO).dividedBy(3)
      : sumMoney(recent.map((c) => c.amount)).dividedBy(3);
    const targetMonth = g.targetDate ? monthKeyOf(fromDbDate(g.targetDate)) : null;
    const p = projectGoal({
      current,
      target: g.targetAmount,
      monthlyPace: pace,
      today: month,
      targetMonth,
    });
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      status: g.status,
      color: g.color,
      notes: g.notes,
      target: toMoneyString(g.targetAmount),
      current: toMoneyString(current),
      initial: toMoneyString(g.initialAmount),
      linkedAccount: g.linkedAccount,
      targetMonth,
      percent: p.percent,
      remaining: toMoneyString(p.remaining),
      achieved: p.achieved,
      monthlyPace: toMoneyString(pace),
      etaMonth: p.etaMonth,
      requiredMonthly: p.requiredMonthly ? toMoneyString(p.requiredMonthly) : null,
      onTrack: p.onTrack,
      contributions: g.contributions.slice(0, 20).map((c) => ({
        id: c.id,
        amount: toMoneyString(c.amount),
        date: fromDbDate(c.date),
        notes: c.notes,
      })),
    };
  });
}

export interface EmergencyFundSummary {
  goal: GoalDTO | null;
  reserve: string;
  monthlyCost: string;
  essentialCost: string;
  /** Meses de despesas cobertos (null se não há despesas pagas para calcular). */
  months: string | null;
  essentialMonths: string | null;
  costMonthsUsed: number;
}

/** Reserva de emergência: quanto tem e quantos meses de despesas cobre (R9). */
export async function emergencyFund(
  ctx: ServiceContext,
  today: ISODate,
): Promise<EmergencyFundSummary> {
  const [goals, cost, essential] = await Promise.all([
    listGoals(ctx, today),
    averageMonthlyCost(ctx, today),
    averageMonthlyCost(ctx, today, { essentialOnly: true }),
  ]);
  const goal = goals.find((g) => g.kind === "EMERGENCY_FUND") ?? null;
  const reserve = goal ? toMoney(goal.current) : ZERO;
  const cov = (c: ReturnType<typeof toMoney>) => (goal ? reserveCoverage(reserve, c) : null);
  return {
    goal,
    reserve: toMoneyString(reserve),
    monthlyCost: toMoneyString(cost.average),
    essentialCost: toMoneyString(essential.average),
    months: cov(cost.average)?.toFixed(1) ?? null,
    essentialMonths: cov(essential.average)?.toFixed(1) ?? null,
    costMonthsUsed: cost.months,
  };
}
