import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";
import { editScopeSchema, repeatSchema } from "@fin/modules/recurrences/schemas";

export const PAYMENT_METHODS = [
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "BOLETO",
  "BANK_TRANSFER",
  "AUTO_DEBIT",
  "CASH",
  "BENEFIT_CARD",
  "OTHER",
] as const;

export const formTypeSchema = z.enum(["INCOME", "EXPENSE", "TRANSFER"]);

const baseFields = {
  type: formTypeSchema,
  description: z.string().trim().min(1, "Descreva o lançamento").max(120, "Use até 120 caracteres"),
  amount: moneyInput(),
  /** Data do fato (compra, venda, serviço). */
  date: isoDate(),
  /** Vencimento ou previsão; se vazio, igual à data. */
  dueDate: isoDate().nullable(),
  settled: z.boolean(),
  settledAt: isoDate().nullable(),
  accountId: z.string().uuid("Escolha a conta").nullable(),
  /** Compra no cartão de crédito (só despesas): vai para a fatura, sem sair da conta. */
  creditCardId: z.string().uuid().nullable(),
  transferAccountId: z.string().uuid("Escolha a conta de destino").nullable(),
  categoryId: z.string().uuid("Escolha a categoria").nullable(),
  nature: z.enum(["FIXED", "VARIABLE"]).nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  notes: optionalText(1000),
};

type Base = z.infer<z.ZodObject<typeof baseFields>>;

function rules(v: Base, ctx: z.RefinementCtx) {
  if (v.type === "TRANSFER") {
    if (!v.accountId)
      ctx.addIssue({ code: "custom", path: ["accountId"], message: "Escolha a conta de origem" });
    if (!v.transferAccountId)
      ctx.addIssue({
        code: "custom",
        path: ["transferAccountId"],
        message: "Escolha a conta de destino",
      });
    if (v.accountId && v.accountId === v.transferAccountId)
      ctx.addIssue({
        code: "custom",
        path: ["transferAccountId"],
        message: "Escolha uma conta diferente da origem",
      });
    return;
  }
  if (!v.categoryId)
    ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Escolha a categoria" });
  if (v.creditCardId && v.type !== "EXPENSE")
    ctx.addIssue({
      code: "custom",
      path: ["creditCardId"],
      message: "Só despesas podem ser pagas no cartão",
    });
  if (v.settled && !v.accountId && !v.creditCardId)
    ctx.addIssue({
      code: "custom",
      path: ["accountId"],
      message:
        v.type === "INCOME" ? "Em qual conta o dinheiro entrou?" : "De qual conta o dinheiro saiu?",
    });
}

export const createTransactionSchema = z
  .object({ ...baseFields, repeat: repeatSchema.nullable() })
  .superRefine(rules);

export const updateTransactionSchema = z
  .object({ ...baseFields, id: z.string().uuid(), scope: editScopeSchema })
  .superRefine(rules);

export const settleSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  settledAt: isoDate(),
  /** Obrigatória quando algum lançamento ainda não tem conta. */
  accountId: z.string().uuid().nullable(),
});

export const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const deleteTransactionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  /** Para ocorrências de recorrência: "future" também encerra a série a partir desta data. */
  scope: z.enum(["this", "future"]),
});

export const balanceAdjustmentSchema = z.object({
  accountId: z.string().uuid(),
  /** Saldo real informado pelo banco hoje (pode ser negativo). */
  actualBalance: moneyInput({ allowNegative: true, allowZero: true }),
  date: isoDate(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
