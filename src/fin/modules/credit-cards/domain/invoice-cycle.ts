import {
  addMonthsToKey,
  clampedDate,
  type ISODate,
  type MonthKey,
  parseISODate,
  parseMonthKey,
} from "@fin/lib/dates";

export interface InvoiceCycle {
  /** Mês do vencimento: "fatura de outubro" vence em outubro (chave do mês). */
  referenceMonth: MonthKey;
  closingDate: ISODate;
  dueDate: ISODate;
}

function closingIn(month: MonthKey, closingDay: number): ISODate {
  const { year, month: m } = parseMonthKey(month);
  return clampedDate(year, m, closingDay);
}

/** Ciclo cujo fechamento cai em `closingMonth`: calcula o vencimento (mesmo mês ou o seguinte). */
export function cycleClosingIn(
  closingMonth: MonthKey,
  closingDay: number,
  dueDay: number,
): InvoiceCycle {
  const dueMonth = dueDay > closingDay ? closingMonth : addMonthsToKey(closingMonth, 1);
  const { year, month } = parseMonthKey(dueMonth);
  return {
    referenceMonth: dueMonth,
    closingDate: closingIn(closingMonth, closingDay),
    dueDate: clampedDate(year, month, dueDay),
  };
}

/**
 * Fatura em que uma compra cai (regra R3): compra antes do fechamento do mês entra na fatura que
 * fecha neste mês; no dia do fechamento ou depois, na seguinte. Dias inexistentes viram o último
 * dia do mês (31 em fevereiro).
 */
export function resolveInvoice(
  purchaseDate: ISODate,
  closingDay: number,
  dueDay: number,
): InvoiceCycle {
  const { year, month } = parseISODate(purchaseDate);
  const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const closesThisMonth = purchaseDate < closingIn(key, closingDay);
  return cycleClosingIn(closesThisMonth ? key : addMonthsToKey(key, 1), closingDay, dueDay);
}

/** Ciclo da fatura de um mês de vencimento (para criar faturas futuras ou navegar entre elas). */
export function cycleForReferenceMonth(
  referenceMonth: MonthKey,
  closingDay: number,
  dueDay: number,
): InvoiceCycle {
  const closingMonth = dueDay > closingDay ? referenceMonth : addMonthsToKey(referenceMonth, -1);
  return cycleClosingIn(closingMonth, closingDay, dueDay);
}

/** Fatura aberta hoje: aquela em que uma compra de hoje cairia. */
export function currentInvoice(today: ISODate, closingDay: number, dueDay: number): InvoiceCycle {
  return resolveInvoice(today, closingDay, dueDay);
}
