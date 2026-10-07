"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { subscriptionSchema, updateSubscriptionAmountSchema } from "./schemas";
import { changeSubscriptionAmount, createSubscription, setSubscriptionStatus } from "./service";

const refresh = () => revalidatePath("/", "layout");

export const createSubscriptionAction = authActionClient
  .metadata({ name: "subscriptions.create" })
  .inputSchema(subscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const s = await createSubscription(ctx.app, parsedInput, ctx.app.today);
    refresh();
    return { id: s.id };
  });

export const changeSubscriptionAmountAction = authActionClient
  .metadata({ name: "subscriptions.changeAmount" })
  .inputSchema(updateSubscriptionAmountSchema)
  .action(async ({ parsedInput, ctx }) => {
    await changeSubscriptionAmount(
      ctx.app,
      parsedInput.id,
      parsedInput.amount,
      parsedInput.fromDate,
    );
    refresh();
  });

export const setSubscriptionStatusAction = authActionClient
  .metadata({ name: "subscriptions.setStatus" })
  .inputSchema(z.object({ id: z.string().uuid(), status: z.enum(["ACTIVE", "PAUSED", "CANCELED"]) }))
  .action(async ({ parsedInput, ctx }) => {
    await setSubscriptionStatus(ctx.app, parsedInput.id, parsedInput.status, ctx.app.today);
    refresh();
  });
