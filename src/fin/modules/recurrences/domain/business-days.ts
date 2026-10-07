import { addDays, daysInMonth, makeISODate, type ISODate, weekdayOf } from "@fin/lib/dates";

/**
 * Calendário bancário brasileiro: feriados nacionais + dias sem expediente bancário
 * (segunda e terça de Carnaval, Sexta-feira Santa e Corpus Christi — calendário FEBRABAN).
 */

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeISODate(year, month, day);
}

export interface Holiday {
  date: ISODate;
  name: string;
}

const cache = new Map<number, Holiday[]>();

export function bankHolidays(year: number): Holiday[] {
  const cached = cache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const fixed: [number, number, string][] = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência do Brasil"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [12, 25, "Natal"],
  ];
  const holidays: Holiday[] = fixed.map(([m, d, name]) => ({
    date: makeISODate(year, m, d),
    name,
  }));
  // Dia Nacional de Zumbi e da Consciência Negra: feriado nacional desde 2024 (Lei 14.759/2023).
  if (year >= 2024) holidays.push({ date: makeISODate(year, 11, 20), name: "Consciência Negra" });
  holidays.push(
    { date: addDays(easter, -48), name: "Carnaval (segunda-feira)" },
    { date: addDays(easter, -47), name: "Carnaval (terça-feira)" },
    { date: addDays(easter, -2), name: "Sexta-feira Santa" },
    { date: addDays(easter, 60), name: "Corpus Christi" },
  );
  holidays.sort((x, y) => x.date.localeCompare(y.date));
  cache.set(year, holidays);
  return holidays;
}

export function holidayOn(date: ISODate): Holiday | undefined {
  return bankHolidays(Number.parseInt(date.slice(0, 4), 10)).find((h) => h.date === date);
}

export function isBusinessDay(date: ISODate): boolean {
  const wd = weekdayOf(date);
  return wd !== 0 && wd !== 6 && !holidayOn(date);
}

/** Próximo dia útil (ou o próprio dia, se já for útil). */
export function nextBusinessDay(date: ISODate): ISODate {
  let d = date;
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

/** Dia útil anterior (ou o próprio dia, se já for útil). */
export function previousBusinessDay(date: ISODate): ISODate {
  let d = date;
  while (!isBusinessDay(d)) d = addDays(d, -1);
  return d;
}

/** n-ésimo dia útil do mês (1 = primeiro). Se o mês não tiver tantos, devolve o último. */
export function nthBusinessDay(year: number, month: number, n: number): ISODate {
  let count = 0;
  let last = makeISODate(year, month, 1);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const d = makeISODate(year, month, day);
    if (isBusinessDay(d)) {
      count++;
      last = d;
      if (count === n) return d;
    }
  }
  return last;
}

export function lastBusinessDay(year: number, month: number): ISODate {
  return previousBusinessDay(makeISODate(year, month, daysInMonth(year, month)));
}
