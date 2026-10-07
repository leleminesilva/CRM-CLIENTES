import { z } from "zod";
import { hexColor, isoDate, moneyInput, monthKey } from "@fin/lib/validation";

export const CARD_BRANDS = ["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"] as const;

const day = z.coerce
  .number()
  .int("Use um dia inteiro")
  .min(1, "Dia de 1 a 31")
  .max(31, "Dia de 1 a 31");

const fields = {
  name: z.string().trim().min(1, "Informe o nome").max(60, "Use até 60 caracteres"),
  issuer: z.string().trim().min(1, "Informe o banco").max(60, "Use até 60 caracteres"),
  brand: z.enum(CARD_BRANDS),
  lastFour: z
    .union([z.string(), z.null()])
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().regex(/^(\d{4})?$/, "Informe os 4 últimos dígitos"))
    .transform((v) => (v === "" ? null : v)),
  creditLimit: moneyInput({ allowZero: true, required: "Informe o limite" }),
  closingDay: day,
  dueDay: day,
  paymentAccountId: z.string().uuid().nullable(),
  color: hexColor.nullable(),
};

export const createCardSchema = z.object(fields);
export const updateCardSchema = z.object({ id: z.string().uuid(), ...fields });

export const payInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  accountId: z.string().uuid("Escolha a conta de onde sai o pagamento"),
  amount: moneyInput(),
  date: isoDate(),
});

export const reconcileSchema = z.object({
  invoiceId: z.string().uuid(),
  statementAmount: moneyInput({ allowZero: true, required: "Informe o valor da fatura" }),
  createAdjustment: z.boolean(),
});

export const moveItemSchema = z.object({ transactionId: z.string().uuid(), referenceMonth: monthKey() });

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
