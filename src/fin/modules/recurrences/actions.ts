"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@fin/lib/db";
import { authActionClient } from "@fin/lib/safe-action";
import { isoDate } from "@fin/lib/validation";
import { repeatSchema } from "./schemas";
import { deleteRecurrence, getOwnedRecurrence, rescheduleFrom, setPaused } from "./service";

export const setRecurrencePausedAction = authActionClient
  .metadata({ name: "recurrences.setPaused" })
  .inputSchema(z.object({ id: z.string().uuid(), paused: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setPaused(ctx.app, parsedInput.id, parsedInput.paused, ctx.app.today);
    revalidatePath("/", "layout");
  });

export const deleteRecurrenceAction = authActionClient
  .metadata({ name: "recurrences.delete" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteRecurrence(ctx.app, parsedInput.id, ctx.app.today);
    revalidatePath("/", "layout");
  });

/** Muda o calendário (frequência, dia, fim) a partir de uma data, preservando o histórico. */
export const rescheduleRecurrenceAction = authActionClient
  .metadata({ name: "recurrences.reschedule" })
  .inputSchema(z.object({ id: z.string().uuid(), fromDate: isoDate(), repeat: repeatSchema }))
  .action(async ({ parsedInput, ctx }) => {
    await prisma.$transaction(async (tx) => {
      const r = await getOwnedRecurrence(tx, ctx.app, parsedInput.id);
      await rescheduleFrom(
        tx,
        ctx.app,
        r,
        {
          type: r.type === "INCOME" ? "INCOME" : "EXPENSE",
          description: r.description,
          amount: r.amount.toString(),
          categoryId: r.categoryId,
          accountId: r.accountId,
          paymentMethod: r.paymentMethod,
          nature: r.nature,
        },
        parsedInput.repeat,
        parsedInput.fromDate,
        ctx.app.today,
      );
    });
    revalidatePath("/", "layout");
  });
