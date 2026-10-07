import { z } from "zod";
import { hexColor, isoDate, moneyInput, monthKey, optionalText } from "@fin/lib/validation";

export const GOAL_KINDS = [
  "EMERGENCY_FUND",
  "SAVINGS",
  "PURCHASE",
  "INVESTMENT",
  "DEBT_PAYOFF",
  "OTHER",
] as const;

const fields = {
  name: z.string().trim().min(1, "Dê um nome à meta").max(80, "Use até 80 caracteres"),
  kind: z.enum(GOAL_KINDS),
  targetAmount: moneyInput({ required: "Informe o valor da meta" }),
  initialAmount: moneyInput({ allowZero: true, required: "Informe quanto já tem (pode ser 0)" }),
  targetMonth: monthKey().nullable(),
  /** Se a meta acompanha uma conta (ex.: poupança da reserva), o valor atual vem do saldo dela. */
  linkedAccountId: z.string().uuid().nullable(),
  color: hexColor.nullable(),
  notes: optionalText(500),
};

export const createGoalSchema = z.object(fields);
export const updateGoalSchema = z.object({ id: z.string().uuid(), ...fields });

export const contributionSchema = z.object({
  goalId: z.string().uuid(),
  /** Positivo = aporte; negativo = resgate. */
  amount: moneyInput({ allowNegative: true }),
  date: isoDate(),
  notes: optionalText(200),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
