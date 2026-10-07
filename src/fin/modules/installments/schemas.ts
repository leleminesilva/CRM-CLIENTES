import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";
import { PAYMENT_METHODS } from "@fin/modules/transactions/schemas";

export const createPlanSchema = z
  .object({
    description: z.string().trim().min(1, "Descreva a compra").max(120, "Use até 120 caracteres"),
    merchant: optionalText(80),
    categoryId: z.string().uuid("Escolha a categoria"),
    totalAmount: moneyInput({ required: "Informe o valor total" }),
    cashPrice: z
      .union([z.string(), z.null()])
      .transform((v) => (v ?? "").trim())
      .pipe(z.union([z.literal(""), moneyInput()]))
      .transform((v) => (v === "" ? null : v)),
    installmentCount: z.coerce
      .number()
      .int("Use um número inteiro")
      .min(2, "Mínimo 2 parcelas")
      .max(420, "Máximo 420 parcelas"),
    priorPaidCount: z.coerce.number().int().min(0, "Não pode ser negativo"),
    purchaseDate: isoDate(),
    /** Cartão ou conta (boleto/carnê). */
    creditCardId: z.string().uuid().nullable(),
    accountId: z.string().uuid().nullable(),
    firstDueDate: isoDate().nullable(),
    paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.priorPaidCount >= v.installmentCount)
      ctx.addIssue({
        code: "custom",
        path: ["priorPaidCount"],
        message: "Precisa ser menor que o total de parcelas",
      });
    if (!v.creditCardId && !v.firstDueDate)
      ctx.addIssue({
        code: "custom",
        path: ["firstDueDate"],
        message: "Informe o vencimento da 1ª parcela",
      });
    if (v.cashPrice && Number.parseFloat(v.cashPrice) > Number.parseFloat(v.totalAmount))
      ctx.addIssue({
        code: "custom",
        path: ["cashPrice"],
        message: "O preço à vista não pode ser maior que o total",
      });
  });

export const settleEarlySchema = z.object({
  planId: z.string().uuid(),
  accountId: z.string().uuid("Escolha a conta"),
  amount: moneyInput({ required: "Informe o valor pago na quitação" }),
  date: isoDate(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
