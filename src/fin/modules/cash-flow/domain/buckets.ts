import { addDays, type ISODate, monthKeyOf, monthRange, weekdayOf } from "@fin/lib/dates";
import { type Money, sumMoney } from "@fin/lib/money";

export type Granularity = "day" | "week" | "month" | "year";

/** Efeito de um evento no dinheiro disponível (soma das contas líquidas). */
export interface CashEvent {
  date: ISODate;
  /** Delta com sinal: entrada positiva, saída negativa. */
  amount: Money;
  kind: "income" | "expense" | "application" | "adjustment";
  /** true = já aconteceu (liquidado); false = previsto. */
  realized: boolean;
  description?: string;
}

export interface Bucket {
  key: string;
  start: ISODate;
  end: ISODate;
  opening: Money;
  income: Money;
  /** Saídas (valor positivo). */
  expense: Money;
  /** Dinheiro movido para contas fora do disponível (reserva, corretora), valor positivo se saiu. */
  applications: Money;
  adjustments: Money;
  net: Money;
  closing: Money;
  /** O período inteiro está no futuro. */
  projected: boolean;
  /** Parte do período já aconteceu e parte é previsão. */
  partial: boolean;
}

function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Início e fim do período (inclusive) que contém a data. */
export function bucketRange(
  date: ISODate,
  granularity: Granularity,
): { key: string; start: ISODate; end: ISODate } {
  switch (granularity) {
    case "day":
      return { key: date, start: date, end: date };
    case "week": {
      const start = mondayOf(date);
      return { key: start, start, end: addDays(start, 6) };
    }
    case "month": {
      const key = monthKeyOf(date);
      return { key, ...monthRange(key) };
    }
    case "year": {
      const year = date.slice(0, 4);
      return { key: year, start: `${year}-01-01`, end: `${year}-12-31` };
    }
  }
}

function nextStart(end: ISODate): ISODate {
  return addDays(end, 1);
}

/**
 * Agrupa eventos em períodos contíguos de `from` a `to`, encadeando o saldo:
 * fechamento de um período = abertura do próximo. `opening` é o saldo no início de `from`
 * já considerando os eventos anteriores.
 */
export function buildBuckets(
  events: CashEvent[],
  opts: { from: ISODate; to: ISODate; granularity: Granularity; opening: Money; today: ISODate },
): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = bucketRange(opts.from, opts.granularity);
  let opening = opts.opening;
  // Eventos entre o início do 1º período e `from` já estão no saldo de abertura informado.
  for (let guard = 0; guard < 4000 && cursor.start <= opts.to; guard++) {
    const inRange = events.filter((e) => e.date >= cursor.start && e.date <= cursor.end);
    const sum = (kind: CashEvent["kind"], sign: 1 | -1) =>
      sumMoney(inRange.filter((e) => e.kind === kind).map((e) => e.amount.times(sign)));
    const income = sum("income", 1);
    const expense = sum("expense", -1);
    const applications = sum("application", -1);
    const adjustments = sum("adjustment", 1);
    const net = income.minus(expense).minus(applications).plus(adjustments);
    buckets.push({
      key: cursor.key,
      start: cursor.start,
      end: cursor.end,
      opening,
      income,
      expense,
      applications,
      adjustments,
      net,
      closing: opening.plus(net),
      projected: cursor.start > opts.today,
      partial: cursor.start <= opts.today && cursor.end > opts.today,
    });
    opening = opening.plus(net);
    cursor = bucketRange(nextStart(cursor.end), opts.granularity);
  }
  return buckets;
}

/** Saldo de abertura de `from`: saldo-base + eventos entre a data-base e `from`. */
export function openingAt(
  base: { date: ISODate; balance: Money },
  events: CashEvent[],
  from: ISODate,
): Money {
  return base.balance.plus(
    sumMoney(events.filter((e) => e.date > base.date && e.date < from).map((e) => e.amount)),
  );
}
