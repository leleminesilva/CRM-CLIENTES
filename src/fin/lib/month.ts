import { isMonthKey, type ISODate, type MonthKey, monthKeyOf } from "./dates";

/** Mês pedido na URL (?mes=AAAA-MM); inválido ou ausente = mês de hoje. */
export function resolveMonth(
  param: string | string[] | undefined,
  today: ISODate,
): { month: MonthKey; currentMonth: MonthKey } {
  const currentMonth = monthKeyOf(today);
  const value = Array.isArray(param) ? param[0] : param;
  return { month: value && isMonthKey(value) ? value : currentMonth, currentMonth };
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(param: string | string[] | undefined): string | undefined {
  const v = Array.isArray(param) ? param[0] : param;
  return v === "" ? undefined : v;
}
