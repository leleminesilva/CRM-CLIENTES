import { z } from "zod";
import { moneyInput, optionalText } from "@fin/lib/validation";

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120, "Use até 120 caracteres"),
  position: optionalText(80),
  salary: moneyInput({ required: "Informe o salário", allowZero: true }),
  payDay: z.number({ message: "Informe o dia" }).int().min(1, "Dia de 1 a 28").max(28, "Dia de 1 a 28"),
  /** Usuário do CRM (para somar as comissões dele ao lado do salário). */
  crmUserId: z.string().trim().max(60).nullable(),
  notes: optionalText(1000),
});

export const updateEmployeeSchema = employeeSchema.and(z.object({ id: z.string().uuid() }));

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const monthSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido") });
