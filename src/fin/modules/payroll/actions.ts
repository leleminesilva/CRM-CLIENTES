"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { employeeSchema, monthSchema, updateEmployeeSchema } from "./schemas";
import { archiveEmployee, createEmployee, generatePayroll, updateEmployee } from "./service";

const refresh = () => revalidatePath("/", "layout");

export const createEmployeeAction = authActionClient
  .metadata({ name: "payroll.createEmployee" })
  .inputSchema(employeeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const e = await createEmployee(ctx.app, parsedInput);
    refresh();
    return { id: e.id };
  });

export const updateEmployeeAction = authActionClient
  .metadata({ name: "payroll.updateEmployee" })
  .inputSchema(updateEmployeeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...input } = parsedInput;
    await updateEmployee(ctx.app, id, input);
    refresh();
  });

export const archiveEmployeeAction = authActionClient
  .metadata({ name: "payroll.archiveEmployee" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await archiveEmployee(ctx.app, parsedInput.id);
    refresh();
  });

export const generatePayrollAction = authActionClient
  .metadata({ name: "payroll.generate" })
  .inputSchema(monthSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await generatePayroll(ctx.app, parsedInput.month);
    refresh();
    return result;
  });
