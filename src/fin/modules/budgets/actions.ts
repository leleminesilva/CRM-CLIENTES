"use server";

import { revalidatePath } from "next/cache";
import { authActionClient } from "@fin/lib/safe-action";
import { removeBudgetSchema, setBudgetSchema } from "./schemas";
import { removeBudget, setBudget } from "./service";

export const setBudgetAction = authActionClient
  .metadata({ name: "budgets.set" })
  .inputSchema(setBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await setBudget(ctx.app, parsedInput);
    revalidatePath("/", "layout");
  });

export const removeBudgetAction = authActionClient
  .metadata({ name: "budgets.remove" })
  .inputSchema(removeBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await removeBudget(ctx.app, parsedInput.categoryId, parsedInput.fromMonth);
    revalidatePath("/", "layout");
  });
