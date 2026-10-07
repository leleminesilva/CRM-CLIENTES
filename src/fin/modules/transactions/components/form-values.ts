import type { z } from "zod";
import type { createTransactionSchema } from "../schemas";

export type TransactionFormValues = z.input<typeof createTransactionSchema>;
export type TransactionFormOutput = z.output<typeof createTransactionSchema>;
