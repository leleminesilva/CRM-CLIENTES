import { z } from "zod";
import { moneyInput, monthKey } from "@fin/lib/validation";

export const setBudgetSchema = z.object({
  categoryId: z.string().uuid("Escolha a categoria"),
  amount: moneyInput({ required: "Informe o limite mensal" }),
  /** O limite vale a partir deste mês; meses anteriores não mudam. */
  fromMonth: monthKey(),
  alertThresholdPercent: z.coerce
    .number()
    .int("Use um número inteiro")
    .min(1, "De 1 a 100")
    .max(100, "De 1 a 100"),
});

export const removeBudgetSchema = z.object({ categoryId: z.string().uuid(), fromMonth: monthKey() });

export type SetBudgetInput = z.infer<typeof setBudgetSchema>;
