import { type Money, round2, toMoney, type MoneyLike } from "@fin/lib/money";

/** Comissão = valor da venda × percentual, arredondada em centavos (meio para cima). */
export function computeCommission(saleAmount: MoneyLike, ratePercent: MoneyLike): Money {
  return round2(toMoney(saleAmount).times(toMoney(ratePercent)).dividedBy(100));
}

/** Mediana e percentis de uma série (usado na previsão por cenários). */
export function percentile(values: Money[], p: number): Money {
  if (values.length === 0) return toMoney(0);
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loV = sorted[lo]!;
  const hiV = sorted[hi]!;
  return round2(loV.plus(hiV.minus(loV).times(rank - lo)));
}
