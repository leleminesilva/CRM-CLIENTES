"use server";

import { revalidatePath } from "next/cache";
import { authActionClient } from "@fin/lib/safe-action";
import { closeMonthSchema, reopenMonthSchema } from "./schemas";
import { closeMonth, reopenMonth } from "./service";

export const closeMonthAction = authActionClient
  .metadata({ name: "closing.close" })
  .inputSchema(closeMonthSchema)
  .action(async ({ parsedInput, ctx }) => {
    await closeMonth(ctx.app, parsedInput.month, parsedInput.notes, ctx.app.today);
    revalidatePath("/", "layout");
  });

export const reopenMonthAction = authActionClient
  .metadata({ name: "closing.reopen", permission: "manage" })
  .inputSchema(reopenMonthSchema)
  .action(async ({ parsedInput, ctx }) => {
    await reopenMonth(ctx.app, parsedInput.month);
    revalidatePath("/", "layout");
  });
