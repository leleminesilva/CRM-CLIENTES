import { z } from "zod";
import { isMonthKey } from "@fin/lib/dates";

const month = z.string().refine(isMonthKey, "Mês inválido");

export const closeMonthSchema = z.object({
  month,
  notes: z.string().trim().max(1000, "Use até 1000 caracteres").nullable(),
});
export const reopenMonthSchema = z.object({ month });
