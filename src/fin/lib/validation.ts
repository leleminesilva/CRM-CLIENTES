import { z } from "zod";
import { isISODate, isMonthKey } from "./dates";
import { parseMoneyInput } from "./money";

const MAX_MONEY = "999999999999.99";

interface MoneyOptions {
  allowNegative?: boolean;
  allowZero?: boolean;
  required?: string;
}

/**
 * Campo de valor: aceita o que a pessoa digita ("1.234,56") e entrega MoneyString ("1234.56").
 * O mesmo schema valida no navegador e no servidor.
 */
export function moneyInput({
  allowNegative = false,
  allowZero = false,
  required = "Informe um valor",
}: MoneyOptions = {}) {
  return z
    .string()
    .trim()
    .min(1, required)
    .transform((raw, ctx) => {
      const value = parseMoneyInput(raw);
      if (!value) {
        ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56" });
        return z.NEVER;
      }
      if (!allowNegative && value.isNegative()) {
        ctx.addIssue({ code: "custom", message: "O valor não pode ser negativo" });
        return z.NEVER;
      }
      if (!allowZero && value.isZero()) {
        ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero" });
        return z.NEVER;
      }
      if (value.abs().greaterThan(MAX_MONEY)) {
        ctx.addIssue({ code: "custom", message: "Valor acima do limite permitido" });
        return z.NEVER;
      }
      return value.toFixed(2);
    });
}

export const isoDate = (message = "Informe uma data válida") =>
  z.string().refine(isISODate, message);

export const monthKey = (message = "Mês inválido") => z.string().refine(isMonthKey, message);

/** Texto opcional: aceita string ou null; vazio vira null. */
export const optionalText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, `Use até ${max} caracteres`))
    .transform((v) => (v === "" ? null : v));

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");

export const idInput = z.object({ id: z.string().uuid() });
