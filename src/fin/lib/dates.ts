/**
 * Datas de negócio (regra R2 / ADR-07): sempre "YYYY-MM-DD", sem horário nem fuso.
 * No banco são colunas DATE; o Prisma as entrega como Date à meia-noite UTC.
 * Toda a aritmética aqui é feita em UTC, então nunca há deslocamento de dia.
 * "Hoje" é calculado no fuso do workspace (padrão: America/Sao_Paulo).
 */

export type ISODate = string;
/** "2026-10" */
export type MonthKey = string;

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;
const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

function pad(n: number, size = 2): string {
  return String(n).padStart(size, "0");
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isISODate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isMonthKey(value: string): boolean {
  const m = MONTH_KEY.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function parseISODate(iso: ISODate): { year: number; month: number; day: number } {
  if (!isISODate(iso)) throw new RangeError(`Data inválida: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}

export function makeISODate(year: number, month: number, day: number): ISODate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Dia limitado ao tamanho do mês: dia 31 em fevereiro vira 28/29. */
export function clampedDate(year: number, month: number, day: number): ISODate {
  return makeISODate(year, month, Math.min(day, daysInMonth(year, month)));
}

function toUTC(iso: ISODate): Date {
  const { year, month, day } = parseISODate(iso);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUTC(date: Date): ISODate {
  return makeISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Data de hoje no fuso informado. */
export function todayISO(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ISO → Date para gravar em coluna DATE. */
export function toDbDate(iso: ISODate): Date {
  return toUTC(iso);
}

/** Date vinda de coluna DATE → ISO. */
export function fromDbDate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** Soma meses mantendo o dia, limitado ao fim do mês (31/01 + 1 mês = 28/02). */
export function addMonths(iso: ISODate, months: number): ISODate {
  const { year, month, day } = parseISODate(iso);
  const index = year * 12 + (month - 1) + months;
  return clampedDate(Math.floor(index / 12), (index % 12) + 1, day);
}

/** a − b em dias. */
export function diffInDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(iso: ISODate): number {
  return toUTC(iso).getUTCDay();
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  if (!isMonthKey(key)) throw new RangeError(`Mês inválido: ${key}`);
  const [y, m] = key.split("-").map(Number) as [number, number];
  return { year: y, month: m };
}

export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  const { year, month } = parseMonthKey(key);
  const index = year * 12 + (month - 1) + months;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

export function firstDayOfMonth(key: MonthKey): ISODate {
  return `${key}-01`;
}

export function lastDayOfMonth(key: MonthKey): ISODate {
  const { year, month } = parseMonthKey(key);
  return makeISODate(year, month, daysInMonth(year, month));
}

export function monthRange(key: MonthKey): { start: ISODate; end: ISODate } {
  return { start: firstDayOfMonth(key), end: lastDayOfMonth(key) };
}

/** Meses entre duas chaves (b − a). */
export function diffInMonths(a: MonthKey, b: MonthKey): number {
  const pa = parseMonthKey(a);
  const pb = parseMonthKey(b);
  return pb.year * 12 + pb.month - (pa.year * 12 + pa.month);
}

// ─── Formatação (pt-BR) ─────────────────────────────────────────────────────

/** "05/10/2026" */
export function formatDate(iso: ISODate): string {
  const { year, month, day } = parseISODate(iso);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** "05/10" */
export function formatDayMonth(iso: ISODate): string {
  const { month, day } = parseISODate(iso);
  return `${pad(day)}/${pad(month)}`;
}

/** "seg, 05/10" */
export function formatWeekdayDate(iso: ISODate): string {
  return `${WEEKDAYS_SHORT[weekdayOf(iso)]}, ${formatDayMonth(iso)}`;
}

/** "outubro de 2026" · "out/26" · "outubro" */
export function formatMonth(key: MonthKey, style: "long" | "short" | "name" = "long"): string {
  const { year, month } = parseMonthKey(key);
  if (style === "short") return `${MONTHS_SHORT[month - 1]}/${String(year).slice(2)}`;
  if (style === "name") return MONTHS_LONG[month - 1] ?? "";
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias" (até 7 dias); depois disso, a data. */
export function formatRelativeDay(iso: ISODate, today: ISODate): string {
  const diff = diffInDays(iso, today);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1 && diff <= 7) return `em ${diff} dias`;
  if (diff < -1 && diff >= -7) return `há ${-diff} dias`;
  return formatDate(iso);
}
