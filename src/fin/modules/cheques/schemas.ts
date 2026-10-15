import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";

export const chequeSchema = z.object({
  direction: z.enum(["ISSUED", "RECEIVED"]),
  number: z.string().trim().min(1, "Informe o número do cheque").max(30, "Use até 30 caracteres"),
  bank: optionalText(60),
  /** Favorecido (emitido) ou emitente (recebido). */
  party: z.string().trim().min(1, "Informe o nome").max(120, "Use até 120 caracteres"),
  amount: moneyInput({ required: "Informe o valor do cheque" }),
  issueDate: isoDate("Informe a data de emissão"),
  /** "Bom para": a data em que o cheque pode ser depositado/compensado. */
  dueDate: isoDate("Informe o “bom para”"),
  accountId: z.string().uuid().nullable(),
  notes: optionalText(1000),
});

export const updateChequeSchema = chequeSchema.and(z.object({ id: z.string().uuid() }));

export type ChequeInput = z.infer<typeof chequeSchema>;
