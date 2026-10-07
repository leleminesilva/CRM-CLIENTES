import { z } from "zod";
import { hexColor, isoDate, moneyInput, optionalText } from "@fin/lib/validation";

export const ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "WALLET",
  "INVESTMENT",
  "BENEFIT",
  "OTHER",
] as const;
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

const fields = {
  name: z.string().trim().min(1, "Informe o nome").max(60, "Use até 60 caracteres"),
  type: accountTypeSchema,
  institution: optionalText(60),
  /** Pode ser negativo (cheque especial) ou zero. */
  initialBalance: moneyInput({
    allowNegative: true,
    allowZero: true,
    required: "Informe o saldo (pode ser 0)",
  }),
  initialBalanceDate: isoDate(),
  isLiquid: z.boolean(),
  includeInNetWorth: z.boolean(),
  color: hexColor.nullable(),
};

export const createAccountSchema = z.object(fields);
export const updateAccountSchema = z.object({ id: z.string().uuid(), ...fields });
export const reorderAccountsSchema = z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(200) });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
