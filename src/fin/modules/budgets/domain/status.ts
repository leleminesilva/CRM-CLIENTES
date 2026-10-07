import { type Money, toMoney, type MoneyLike } from "@fin/lib/money";

export type BudgetState = "ok" | "warning" | "over";

export interface BudgetProgress {
  /** Gasto ÷ limite (pode passar de 1). */
  ratio: Money;
  available: Money;
  /** Quanto passou do limite (0 se não passou). */
  excess: Money;
  state: BudgetState;
}

/**
 * Progresso do orçamento (R8): "warning" ao atingir o limiar configurado, "over" ao estourar.
 * Limite zero com gasto conta como estouro; limite zero sem gasto fica ok.
 */
export function budgetProgress(
  limit: MoneyLike,
  spent: MoneyLike,
  thresholdPercent: number,
): BudgetProgress {
  const l = toMoney(limit);
  const s = toMoney(spent);
  const available = l.minus(s);
  const ratio = l.isZero() ? (s.greaterThan(0) ? toMoney(2) : toMoney(0)) : s.dividedBy(l);
  const state: BudgetState = s.greaterThan(l)
    ? "over"
    : ratio.times(100).greaterThanOrEqualTo(thresholdPercent) && s.greaterThan(0)
      ? "warning"
      : "ok";
  return { ratio, available, excess: available.isNegative() ? available.abs() : toMoney(0), state };
}
