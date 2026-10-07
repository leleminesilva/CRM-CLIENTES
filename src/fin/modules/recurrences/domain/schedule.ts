import { addDays, clampedDate, type ISODate, parseISODate, weekdayOf } from "@fin/lib/dates";
import {
  lastBusinessDay,
  nextBusinessDay,
  nthBusinessDay,
  previousBusinessDay,
} from "./business-days";

export type Frequency = "WEEKLY" | "MONTHLY" | "YEARLY";
export type DayRule = "FIXED_DAY" | "NTH_BUSINESS_DAY" | "LAST_BUSINESS_DAY";
export type Shift = "NONE" | "NEXT" | "PREVIOUS";

export interface ScheduleRule {
  frequency: Frequency;
  intervalCount: number;
  dayRule: DayRule;
  /** FIXED_DAY: 1–31 (31 = último dia) · NTH_BUSINESS_DAY: n. Padrão: dia da data inicial. */
  dayOfMonth: number | null;
  /** WEEKLY: 0 (domingo) – 6. Padrão: dia da semana da data inicial. */
  weekday: number | null;
  /** YEARLY: 1–12. Padrão: mês da data inicial. */
  monthOfYear: number | null;
  nonBusinessDayShift: Shift;
  startDate: ISODate;
  endDate: ISODate | null;
  maxOccurrences: number | null;
}

export interface Occurrence {
  /** Posição na série (0 = primeira), contada desde o início da regra. */
  index: number;
  /** Data "natural" pela regra — chave de idempotência da geração. */
  naturalDate: ISODate;
  /** Data de vencimento/previsão após o ajuste de dia útil. */
  dueDate: ISODate;
}

const SAFETY_LIMIT = 2000;

function applyShift(date: ISODate, shift: Shift): ISODate {
  if (shift === "NEXT") return nextBusinessDay(date);
  if (shift === "PREVIOUS") return previousBusinessDay(date);
  return date;
}

function dayInMonth(rule: ScheduleRule, year: number, month: number, fallbackDay: number): ISODate {
  if (rule.dayRule === "NTH_BUSINESS_DAY") return nthBusinessDay(year, month, rule.dayOfMonth ?? 1);
  if (rule.dayRule === "LAST_BUSINESS_DAY") return lastBusinessDay(year, month);
  return clampedDate(year, month, rule.dayOfMonth ?? fallbackDay);
}

/** Datas naturais da série, em ordem, a partir da data inicial (gerador infinito, limitado). */
function* naturalDates(rule: ScheduleRule): Generator<ISODate> {
  const start = parseISODate(rule.startDate);
  const step = Math.max(1, rule.intervalCount);

  if (rule.frequency === "WEEKLY") {
    const target = rule.weekday ?? weekdayOf(rule.startDate);
    let d = addDays(rule.startDate, (target - weekdayOf(rule.startDate) + 7) % 7);
    for (let i = 0; i < SAFETY_LIMIT; i++) {
      yield d;
      d = addDays(d, 7 * step);
    }
    return;
  }

  if (rule.frequency === "MONTHLY") {
    for (let k = 0; k < SAFETY_LIMIT; k++) {
      const index = start.year * 12 + (start.month - 1) + k * step;
      const date = dayInMonth(rule, Math.floor(index / 12), (index % 12) + 1, start.day);
      if (date >= rule.startDate) yield date;
    }
    return;
  }

  const month = rule.monthOfYear ?? start.month;
  for (let k = 0; k < SAFETY_LIMIT; k++) {
    const date = dayInMonth(rule, start.year + k * step, month, start.day);
    if (date >= rule.startDate) yield date;
  }
}

/**
 * Ocorrências com data natural entre `from` (inclusive) e `until` (inclusive).
 * Respeita data final e número máximo de ocorrências contados desde o início da série.
 */
export function occurrencesBetween(
  rule: ScheduleRule,
  from: ISODate,
  until: ISODate,
): Occurrence[] {
  const result: Occurrence[] = [];
  let index = 0;
  for (const natural of naturalDates(rule)) {
    if (rule.maxOccurrences !== null && index >= rule.maxOccurrences) break;
    if (rule.endDate !== null && natural > rule.endDate) break;
    if (natural > until) break;
    if (natural >= from) {
      const dueDate =
        rule.dayRule === "FIXED_DAY" ? applyShift(natural, rule.nonBusinessDayShift) : natural;
      result.push({ index, naturalDate: natural, dueDate });
    }
    index++;
  }
  return result;
}

/** Quantas ocorrências a regra tem por ano (para custo mensal/anual equivalente). */
export function occurrencesPerYear(
  rule: Pick<ScheduleRule, "frequency" | "intervalCount">,
): number {
  const step = Math.max(1, rule.intervalCount);
  if (rule.frequency === "WEEKLY") return 52 / step;
  if (rule.frequency === "MONTHLY") return 12 / step;
  return 1 / step;
}
