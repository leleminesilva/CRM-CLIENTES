"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { createPlanSchema, settleEarlySchema } from "./schemas";
import { createInstallmentPlan, deleteInstallmentPlan, settleEarly } from "./service";

export const createPlanAction = authActionClient
  .metadata({ name: "installments.create" })
  .inputSchema(createPlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const plan = await createInstallmentPlan(ctx.app, parsedInput, ctx.app.today);
    revalidatePath("/", "layout");
    return { id: plan.id };
  });

export const settleEarlyAction = authActionClient
  .metadata({ name: "installments.settleEarly" })
  .inputSchema(settleEarlySchema)
  .action(async ({ parsedInput, ctx }) => {
    await settleEarly(ctx.app, parsedInput, ctx.app.today);
    revalidatePath("/", "layout");
  });

export const deletePlanAction = authActionClient
  .metadata({ name: "installments.delete" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteInstallmentPlan(ctx.app, parsedInput.id, ctx.app.today);
    revalidatePath("/", "layout");
  });
