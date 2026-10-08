import type { MonthKey } from "@fin/lib/dates";
import { type Money, ZERO } from "@fin/lib/money";
import { percentile } from "@fin/modules/commissions/domain/commission";

export type Scenario = "conservative" | "realistic" | "optimistic";

export const SCENARIO_PERCENTILE: Record<Scenario, number> = {
  conservative: 25,
  realistic: 50,
  optimistic: 75,
};
export const SCENARIO_LABEL: Record<Scenario, string> = {
  conservative: "Conservador",
  realistic: "Realista",
  optimistic: "Otimista",
};

/** O que já está cadastrado para um mês futuro (o "certo"). */
export interface MonthInput {
  month: MonthKey;
  /** Receitas previstas e ainda pendentes. */
  scheduledIncome: Money;
  /** Despesas previstas e ainda pendentes, incluindo o que falta pagar de faturas. */
  scheduledExpense: Money;
  /** Comissões já cadastradas no mês (recebidas ou não): base para o complemento estatístico. */
  registeredCommission: Money;
  /** Despesas variáveis (não fixas, sem parcelas) já lançadas no mês, pagas ou pendentes. */
  variableIncurred: Money;
}

export interface MonthProjection {
  month: MonthKey;
  scheduledIncome: Money;
  /** Complemento estatístico de comissões (quando o cadastrado é menor que o típico). */
  commissionComplement: Money;
  income: Money;
  scheduledExpense: Money;
  /** Estimativa de variáveis que ainda não foram lançadas. */
  variableEstimate: Money;
  expense: Money;
  net: Money;
  closing: Money;
  negative: boolean;
}

export interface ProjectionInput {
  opening: Money;
  months: MonthInput[];
  /** Comissão total por mês nos últimos 12 meses (incluindo zeros). */
  commissionHistory: Money[];
  /** Média mensal de despesas variáveis dos últimos 6 meses completos (0 = sem histórico). */
  variableAverage: Money;
  scenario: Scenario;
}

/**
 * Projeção (R11): para cada mês = receitas agendadas − despesas agendadas − variáveis estimadas −
 * complemento de comissões a pagar pelo cenário (percentil do histórico). O complemento só entra com
 * pelo menos 3 meses de histórico; a estimativa de variáveis desconta o que já foi lançado.
 */
export function projectMonths(input: ProjectionInput): MonthProjection[] {
  const historyUsable = input.commissionHistory.filter((v) => v.greaterThan(0)).length >= 3;
  const typical = historyUsable
    ? percentile(input.commissionHistory, SCENARIO_PERCENTILE[input.scenario])
    : ZERO;
  let balance = input.opening;
  return input.months.map((m) => {
    const complement = typical.minus(m.registeredCommission);
    const commissionComplement = complement.greaterThan(0) ? complement : ZERO;
    const remainingVariable = input.variableAverage.minus(m.variableIncurred);
    const variableEstimate = remainingVariable.greaterThan(0) ? remainingVariable : ZERO;
    const income = m.scheduledIncome;
    const expense = m.scheduledExpense.plus(variableEstimate).plus(commissionComplement);
    const net = income.minus(expense);
    balance = balance.plus(net);
    return {
      month: m.month,
      scheduledIncome: m.scheduledIncome,
      commissionComplement,
      income,
      scheduledExpense: m.scheduledExpense,
      variableEstimate,
      expense,
      net,
      closing: balance,
      negative: balance.isNegative(),
    };
  });
}

export function firstNegative(projection: MonthProjection[]): MonthProjection | null {
  return projection.find((p) => p.negative) ?? null;
}
