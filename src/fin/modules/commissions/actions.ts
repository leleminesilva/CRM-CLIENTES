"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { commissionSchema, importCommissionsSchema, updateCommissionSchema } from "./schemas";
import {
  createCommission,
  deleteCommission,
  importCommissions,
  setCommissionWork,
  setCommissionCanceled,
  updateCommission,
} from "./service";

const refresh = () => revalidatePath("/", "layout");

export const createCommissionAction = authActionClient
  .metadata({ name: "commissions.create" })
  .inputSchema(commissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const c = await createCommission(ctx.app, parsedInput);
    refresh();
    return { id: c.id };
  });

export const updateCommissionAction = authActionClient
  .metadata({ name: "commissions.update" })
  .inputSchema(updateCommissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...input } = parsedInput;
    await updateCommission(ctx.app, id, input);
    refresh();
  });

export const setCommissionCanceledAction = authActionClient
  .metadata({ name: "commissions.setCanceled" })
  .inputSchema(z.object({ id: z.string().uuid(), canceled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setCommissionCanceled(ctx.app, parsedInput.id, parsedInput.canceled);
    refresh();
  });

export const deleteCommissionAction = authActionClient
  .metadata({ name: "commissions.delete" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteCommission(ctx.app, parsedInput.id);
    refresh();
  });

export const importCommissionsAction = authActionClient
  .metadata({ name: "commissions.import" })
  .inputSchema(importCommissionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await importCommissions(ctx.app, parsedInput);
    refresh();
    return result;
  });

export const setCommissionWorkAction = authActionClient
  .metadata({ name: "commissions.setWork" })
  .inputSchema(
    z.object({
      id: z.string().uuid(),
      didMeasurements: z.boolean().optional(),
      didProject: z.boolean().optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...flags } = parsedInput;
    await setCommissionWork(ctx.app, id, flags);
    refresh();
  });
