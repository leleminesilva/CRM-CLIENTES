import { Prisma } from "@prisma/client";
import {
  addMonthsToKey,
  type ISODate,
  type MonthKey,
  monthKeyOf,
  monthRange,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { type Money, sumMoney, toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { currentLiquidBalance, loadCashEvents } from "@fin/modules/cash-flow/queries";
import { percentile } from "@fin/modules/commissions/domain/commission";
import {
  type MonthInput,
  type MonthProjection,
  projectMonths,
  SCENARIO_PERCENTILE,
  type Scenario,
} from "./domain/project";

async function monthlyAmounts(ctx: ServiceContext, sql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<{ month: string; total: string }[]>(sql);
  return new Map(rows.map((r) => [r.month, toMoney(r.total)]));
}

/** Comissão total por mês (pela previsão de pagamento) nos 12 meses completos anteriores. */
async function commissionHistory(ctx: ServiceContext, today: ISODate): Promise<Money[]> {
  const current = monthKeyOf(today);
  const start = addMonthsToKey(current, -12);
  const byMonth = await monthlyAmounts(
    ctx,
    Prisma.sql`
    SELECT to_char(t.due_date, 'YYYY-MM') AS month, SUM(t.amount)::text AS total
    FROM fin_commissions c JOIN fin_transactions t ON t.id = c.transaction_id
    WHERE c.workspace_id = ${ctx.workspaceId}::uuid AND c.deleted_at IS NULL AND t.deleted_at IS NULL AND t.status <> 'CANCELED'
      AND t.due_date BETWEEN ${toDbDate(monthRange(start).start)} AND ${toDbDate(monthRange(addMonthsToKey(current, -1)).end)}
    GROUP BY 1`,
  );
  return Array.from({ length: 12 }, (_, i) => byMonth.get(addMonthsToKey(start, i)) ?? ZERO);
}

/** Despesas variáveis (sem parcelas e sem séries) por mês — base da estimativa. */
async function variableByMonth(ctx: ServiceContext, from: MonthKey, to: MonthKey) {
  return monthlyAmounts(
    ctx,
    Prisma.sql`
    SELECT to_char(due_date, 'YYYY-MM') AS month,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE -amount END)::text AS total
    FROM fin_transactions
    WHERE workspace_id = ${ctx.workspaceId}::uuid AND deleted_at IS NULL AND status <> 'CANCELED' AND is_balance_adjustment = false
      AND type IN ('EXPENSE', 'REFUND') AND nature = 'VARIABLE' AND installment_plan_id IS NULL AND recurrence_id IS NULL
      AND id NOT IN (SELECT transaction_id FROM fin_commissions)
      AND due_date BETWEEN ${toDbDate(monthRange(from).start)} AND ${toDbDate(monthRange(to).end)}
    GROUP BY 1`,
  );
}

async function commissionByMonth(ctx: ServiceContext, from: MonthKey, to: MonthKey) {
  return monthlyAmounts(
    ctx,
    Prisma.sql`
    SELECT to_char(t.due_date, 'YYYY-MM') AS month, SUM(t.amount)::text AS total
    FROM fin_commissions c JOIN fin_transactions t ON t.id = c.transaction_id
    WHERE c.workspace_id = ${ctx.workspaceId}::uuid AND c.deleted_at IS NULL AND t.deleted_at IS NULL AND t.status <> 'CANCELED'
      AND t.due_date BETWEEN ${toDbDate(monthRange(from).start)} AND ${toDbDate(monthRange(to).end)}
    GROUP BY 1`,
  );
}

export interface ForecastResult {
  opening: string;
  scenario: Scenario;
  months: (Omit<
    MonthProjection,
    | "scheduledIncome"
    | "commissionComplement"
    | "income"
    | "scheduledExpense"
    | "variableEstimate"
    | "expense"
    | "net"
    | "closing"
  > & {
    scheduledIncome: string;
    commissionComplement: string;
    income: string;
    scheduledExpense: string;
    variableEstimate: string;
    expense: string;
    net: string;
    closing: string;
  })[];
  /** Saldo final de cada cenário, para a faixa do gráfico. */
  bands: Record<Scenario, string[]>;
  variableAverage: string;
  commissionTypical: Record<Scenario, string>;
  historyMonths: number;
  firstNegative: { month: MonthKey; closing: string } | null;
}

/** Previsão para os próximos N meses (3, 6 ou 12), com os três cenários de comissão (R11). */
export async function forecast(
  ctx: ServiceContext,
  today: ISODate,
  horizon: 3 | 6 | 12,
  scenario: Scenario,
): Promise<ForecastResult> {
  const current = monthKeyOf(today);
  const keys = Array.from({ length: horizon }, (_, i) => addMonthsToKey(current, i));
  const last = keys[horizon - 1]!;
  const opening = await currentLiquidBalance(ctx, today);
  const { events } = await loadCashEvents(ctx, today, monthRange(last).end, today);

  const pending = events.filter((e) => !e.realized);
  const byMonth = (inflow: boolean) => {
    const map = new Map<string, Money>();
    for (const e of pending) {
      if (e.kind === "adjustment") continue;
      if (e.amount.greaterThan(0) !== inflow) continue;
      const key = monthKeyOf(e.date);
      map.set(key, (map.get(key) ?? ZERO).plus(e.amount.abs()));
    }
    return map;
  };
  const income = byMonth(true);
  const expense = byMonth(false);
  const [regCommission, variable, history, past] = await Promise.all([
    commissionByMonth(ctx, current, last),
    variableByMonth(ctx, current, last),
    commissionHistory(ctx, today),
    variableByMonth(ctx, addMonthsToKey(current, -6), addMonthsToKey(current, -1)),
  ]);
  const pastValues = [...past.values()].filter((v) => v.greaterThan(0));
  const variableAverage = pastValues.length
    ? sumMoney(pastValues).dividedBy(pastValues.length)
    : ZERO;

  const months: MonthInput[] = keys.map((month) => ({
    month,
    scheduledIncome: income.get(month) ?? ZERO,
    scheduledExpense: expense.get(month) ?? ZERO,
    registeredCommission: regCommission.get(month) ?? ZERO,
    variableIncurred: variable.get(month) ?? ZERO,
  }));
  const run = (s: Scenario) =>
    projectMonths({ opening, months, commissionHistory: history, variableAverage, scenario: s });
  const chosen = run(scenario);
  const fmt = (p: MonthProjection) => ({
    ...p,
    scheduledIncome: toMoneyString(p.scheduledIncome),
    commissionComplement: toMoneyString(p.commissionComplement),
    income: toMoneyString(p.income),
    scheduledExpense: toMoneyString(p.scheduledExpense),
    variableEstimate: toMoneyString(p.variableEstimate),
    expense: toMoneyString(p.expense),
    net: toMoneyString(p.net),
    closing: toMoneyString(p.closing),
  });
  const neg = chosen.find((p) => p.negative);
  const usable = history.filter((v) => v.greaterThan(0)).length >= 3;
  const typical = (s: Scenario) => (usable ? percentile(history, SCENARIO_PERCENTILE[s]) : ZERO);
  return {
    opening: toMoneyString(opening),
    scenario,
    months: chosen.map(fmt),
    bands: {
      conservative: run("conservative").map((p) => toMoneyString(p.closing)),
      realistic: run("realistic").map((p) => toMoneyString(p.closing)),
      optimistic: run("optimistic").map((p) => toMoneyString(p.closing)),
    },
    variableAverage: toMoneyString(variableAverage),
    commissionTypical: {
      conservative: toMoneyString(typical("conservative")),
      realistic: toMoneyString(typical("realistic")),
      optimistic: toMoneyString(typical("optimistic")),
    },
    historyMonths: history.filter((v) => v.greaterThan(0)).length,
    firstNegative: neg ? { month: neg.month, closing: toMoneyString(neg.closing) } : null,
  };
}
