import Decimal from "decimal.js";

/**
 * Dinheiro no sistema (regra R1):
 * - banco: NUMERIC(14,2);
 * - servidor: Decimal (precisão ampla, arredondamento comercial);
 * - fronteira servidor ↔ navegador: texto "1234.56" (MoneyString).
 * Nunca `number` para cálculo.
 */
export const Money = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
export type Money = Decimal;

/** Valor monetário serializado: "1234.56" (ponto decimal, sem separador de milhar). */
export type MoneyString = string;

export type MoneyLike = Decimal.Value | { toString(): string };

export function toMoney(value: MoneyLike): Decimal {
  if (typeof value === "number" || typeof value === "string") return new Money(value);
  return new Money(value.toString());
}

export const ZERO: Decimal = new Money(0);

/** Arredonda em centavos (meio para cima). */
export function round2(value: MoneyLike): Decimal {
  return toMoney(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function toMoneyString(value: MoneyLike): MoneyString {
  return round2(value).toFixed(2);
}

export function sumMoney(values: Iterable<MoneyLike>): Decimal {
  let total = ZERO;
  for (const v of values) total = total.plus(toMoney(v));
  return total;
}

/**
 * Divide um total em N partes em centavos; a diferença vai para a 1ª parte, como os bancos fazem.
 * Ex.: 1000 ÷ 3 = [333.34, 333.33, 333.33].
 */
export function splitEvenly(total: MoneyLike, parts: number): Decimal[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new RangeError("O número de partes precisa ser um inteiro maior que zero.");
  }
  const cents = toMoney(total).times(100);
  if (!cents.isInteger()) throw new RangeError("O total tem mais de duas casas decimais.");
  if (cents.isNegative()) throw new RangeError("O total não pode ser negativo.");
  const base = cents.dividedToIntegerBy(parts);
  if (base.isZero()) throw new RangeError("Cada parte ficaria menor que R$ 0,01.");
  const remainder = cents.minus(base.times(parts));
  return Array.from({ length: parts }, (_, i) =>
    (i === 0 ? base.plus(remainder) : base).dividedBy(100),
  );
}

/**
 * Lê o que a pessoa digitou: "1.234,56", "1234,56", "1234.56", "R$ 12", ",5", "1.234".
 * Retorna null se não for um valor válido ou tiver mais de 2 casas decimais.
 */
export function parseMoneyInput(raw: string): Decimal | null {
  let s = raw.trim().replace(/^R\$/i, "").replace(/[\s ]/g, "");
  let negative = false;
  if (/^[-−]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let frac = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const groupSep = decimalSep === "," ? "." : ",";
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    frac = s.slice(idx + 1);
    if (intPart.includes(decimalSep) || !hasValidGroups(intPart, groupSep)) return null;
    intPart = intPart.split(groupSep).join("");
  } else if (lastComma >= 0) {
    if (s.indexOf(",") !== lastComma) return null;
    intPart = s.slice(0, lastComma);
    frac = s.slice(lastComma + 1);
  } else if (lastDot >= 0) {
    const groups = s.split(".");
    const last = groups[groups.length - 1] ?? "";
    // "1.234" e "1.234.567" são milhares (pt-BR); "1.5" e "1234.56" são decimais.
    if (groups.length > 2 || last.length === 3) {
      if (!hasValidGroups(s, ".")) return null;
      intPart = groups.join("");
    } else {
      intPart = groups[0] ?? "";
      frac = last;
    }
  } else {
    intPart = s;
  }

  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || (frac !== "" && !/^\d+$/.test(frac)) || frac.length > 2) {
    return null;
  }
  const value = new Money(`${intPart}.${frac || "0"}`);
  return negative ? value.negated() : value;
}

function hasValidGroups(value: string, sep: string): boolean {
  const groups = value.split(sep);
  if (groups.length === 1) return /^\d+$/.test(value);
  return groups.every((g, i) => (i === 0 ? /^\d{1,3}$/.test(g) : /^\d{3}$/.test(g)));
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const MINUS = "−";

export interface FormatMoneyOptions {
  /** "auto": só "−" em negativos · "always": também "+" em positivos · "never": sem sinal. */
  sign?: "auto" | "always" | "never";
  /** "R$ 12 mil" — para eixos e espaços curtos. */
  compact?: boolean;
}

/** "R$ 1.234,56" · "R$ −89,90" · "R$ +850,00" · "R$ 12 mil". O sinal vem depois do "R$". */
export function formatMoney(value: MoneyLike, options: FormatMoneyOptions = {}): string {
  const d = toMoney(value);
  // Exibição apenas: até 999 bilhões com centavos cabe exatamente num double.
  const body = (options.compact ? brlCompact : brl).format(d.abs().toNumber());
  const mode = options.sign ?? "auto";
  let sign = "";
  if (mode !== "never" && !d.isZero()) {
    if (d.isNegative()) sign = MINUS;
    else if (mode === "always") sign = "+";
  }
  if (!sign) return body;
  // "R$ 89,90" → "R$ −89,90": insere o sinal logo depois do símbolo e do espaço.
  return body.replace(/^(R\$[\s\u00a0]*)/, `$1${sign}`);
}

export interface MoneyParts {
  sign: "" | "+" | typeof MINUS;
  currency: string;
  integer: string;
  cents: string;
}

/** Partes do valor para a anatomia tipográfica (R$ e centavos menores). */
export function moneyParts(
  value: MoneyLike,
  options: Pick<FormatMoneyOptions, "sign"> = {},
): MoneyParts {
  const d = toMoney(value);
  const parts = brl.formatToParts(d.abs().toNumber());
  const integer = parts
    .filter((p) => p.type === "integer" || p.type === "group")
    .map((p) => p.value)
    .join("");
  const cents = parts.find((p) => p.type === "fraction")?.value ?? "00";
  const currency = parts.find((p) => p.type === "currency")?.value ?? "R$";
  const mode = options.sign ?? "auto";
  let sign: MoneyParts["sign"] = "";
  if (mode !== "never" && !d.isZero()) {
    if (d.isNegative()) sign = MINUS;
    else if (mode === "always") sign = "+";
  }
  return { sign, currency, integer, cents };
}

const percentFormatters = new Map<number, Intl.NumberFormat>();

/** 0.62 → "62%" · 0.625 com 1 casa → "62,5%". */
export function formatPercent(ratio: MoneyLike | null, fractionDigits = 0): string {
  if (ratio === null) return "—";
  let fmt = percentFormatters.get(fractionDigits);
  if (!fmt) {
    fmt = new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    percentFormatters.set(fractionDigits, fmt);
  }
  return fmt.format(toMoney(ratio).toNumber());
}

/** parte ÷ todo, ou null quando o todo é zero (evita "Infinity%"). */
export function ratio(part: MoneyLike, whole: MoneyLike): Decimal | null {
  const w = toMoney(whole);
  if (w.isZero()) return null;
  return toMoney(part).dividedBy(w);
}
