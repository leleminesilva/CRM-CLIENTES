import { addMonthsToKey, type MonthKey } from "@fin/lib/dates";
import { type Money, toMoney, type MoneyLike } from "@fin/lib/money";

export interface GoalProjection {
  percent: number;
  remaining: Money;
  achieved: boolean;
  /** Mês em que a meta será atingida no ritmo atual (null se o ritmo é zero ou negativo). */
  etaMonth: MonthKey | null;
  /** Meses até atingir. */
  monthsToGo: number | null;
  /** Aporte mensal necessário para chegar na data-alvo (null sem data-alvo). */
  requiredMonthly: Money | null;
  /** No ritmo atual, chega antes ou na data-alvo? null sem data-alvo ou sem previsão. */
  onTrack: boolean | null;
}

/**
 * Previsão de uma meta (R9): ritmo = média líquida de aportes dos últimos 3 meses.
 * Sem ritmo positivo não há previsão de data, mas o aporte necessário ainda é informado.
 */
export function projectGoal(opts: {
  current: MoneyLike;
  target: MoneyLike;
  monthlyPace: MoneyLike;
  today: MonthKey;
  targetMonth?: MonthKey | null;
}): GoalProjection {
  const current = toMoney(opts.current);
  const target = toMoney(opts.target);
  const pace = toMoney(opts.monthlyPace);
  const remaining = target.minus(current);
  const achieved = remaining.lessThanOrEqualTo(0);
  const percent = target.isZero()
    ? 100
    : Math.max(0, Math.min(100, current.dividedBy(target).times(100).toNumber()));

  let monthsToGo: number | null = null;
  if (achieved) monthsToGo = 0;
  else if (pace.greaterThan(0)) monthsToGo = remaining.dividedBy(pace).ceil().toNumber();

  let requiredMonthly: Money | null = null;
  if (opts.targetMonth && !achieved) {
    const [ty, tm] = opts.targetMonth.split("-").map(Number) as [number, number];
    const [cy, cm] = opts.today.split("-").map(Number) as [number, number];
    const months = Math.max(1, ty * 12 + tm - (cy * 12 + cm));
    requiredMonthly = remaining.dividedBy(months).toDecimalPlaces(2, 0 /* ROUND_UP */);
  }
  const etaMonth = monthsToGo === null ? null : addMonthsToKey(opts.today, monthsToGo);
  return {
    percent,
    remaining: achieved ? toMoney(0) : remaining,
    achieved,
    etaMonth: achieved ? null : etaMonth,
    monthsToGo,
    requiredMonthly,
    onTrack: opts.targetMonth && etaMonth && !achieved ? etaMonth <= opts.targetMonth : null,
  };
}

/** Quantos meses de despesas a reserva cobre. null sem despesas (não dá para calcular). */
export function reserveCoverage(reserve: MoneyLike, monthlyCost: MoneyLike): Money | null {
  const cost = toMoney(monthlyCost);
  if (cost.lessThanOrEqualTo(0)) return null;
  return toMoney(reserve).dividedBy(cost);
}
