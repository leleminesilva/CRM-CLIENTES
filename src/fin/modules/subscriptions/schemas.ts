import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";

export const subscriptionSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o serviço").max(80, "Use até 80 caracteres"),
    provider: optionalText(80),
    website: z
      .union([z.string(), z.null()])
      .transform((v) => (v ?? "").trim())
      .pipe(z.union([z.literal(""), z.string().url("Endereço inválido (use https://…)")]))
      .transform((v) => (v === "" ? null : v)),
    amount: moneyInput(),
    billing: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY"]),
    /** Próxima cobrança (define o dia e, se anual, o mês). */
    nextChargeDate: isoDate(),
    categoryId: z.string().uuid("Escolha a categoria"),
    accountId: z.string().uuid().nullable(),
    creditCardId: z.string().uuid().nullable(),
    trialEndsAt: isoDate().nullable(),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (!v.accountId && !v.creditCardId)
      ctx.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "Escolha a conta ou o cartão que paga",
      });
  });

export const updateSubscriptionAmountSchema = z.object({
  id: z.string().uuid(),
  amount: moneyInput(),
  fromDate: isoDate(),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
