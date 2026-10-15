"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { syncCommissionsForMonth } from "@fin/crm/comissoes";
import { isMonthKey } from "@fin/lib/dates";
import { assertCan } from "@fin/lib/permissions";
import {
  commissionSchema,
  commissionSettingsSchema,
  importCommissionsSchema,
  updateCommissionSchema,
} from "./schemas";
import {
  createCommission,
  deleteCommission,
  importCommissions,
  saveCommissionSettings,
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

export const saveCommissionSettingsAction = authActionClient
  .metadata({ name: "commissions.settings" })
  .inputSchema(commissionSettingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    await saveCommissionSettings(ctx.app, parsedInput);
    refresh();
  });

/** Gera as comissões que faltam das vendas do mês (as que já existem são ligadas, não duplicadas). */
export const syncCommissionsFromSalesAction = authActionClient
  .metadata({ name: "commissions.syncSales" })
  .inputSchema(z.object({ month: z.string().refine(isMonthKey, "Mês inválido") }))
  .action(async ({ parsedInput, ctx }) => {
    assertCan(ctx.app, "write");
    const result = await syncCommissionsForMonth(ctx.app.userId, parsedInput.month);
    refresh();
    return result;
  });
