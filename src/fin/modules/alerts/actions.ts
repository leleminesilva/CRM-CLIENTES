"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { dismiss, markAllRead, markRead, snooze } from "./service";

const id = z.object({ id: z.string().uuid() });
const refresh = () => revalidatePath("/", "layout");

export const markAlertReadAction = authActionClient
  .metadata({ name: "alerts.read", permission: "read" })
  .inputSchema(id)
  .action(async ({ parsedInput, ctx }) => {
    await markRead(ctx.app, parsedInput.id);
    refresh();
  });

export const markAllAlertsReadAction = authActionClient
  .metadata({ name: "alerts.readAll", permission: "read" })
  .action(async ({ ctx }) => {
    await markAllRead(ctx.app);
    refresh();
  });

export const dismissAlertAction = authActionClient
  .metadata({ name: "alerts.dismiss", permission: "read" })
  .inputSchema(id)
  .action(async ({ parsedInput, ctx }) => {
    await dismiss(ctx.app, parsedInput.id);
    refresh();
  });

export const snoozeAlertAction = authActionClient
  .metadata({ name: "alerts.snooze", permission: "read" })
  .inputSchema(id.extend({ days: z.union([z.literal(1), z.literal(7)]) }))
  .action(async ({ parsedInput, ctx }) => {
    await snooze(ctx.app, parsedInput.id, parsedInput.days);
    refresh();
  });
