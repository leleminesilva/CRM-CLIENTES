"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { suggestDescriptions } from "./queries";
import {
  balanceAdjustmentSchema,
  createTransactionSchema,
  deleteTransactionsSchema,
  idsSchema,
  settleSchema,
  updateTransactionSchema,
} from "./schemas";
import {
  adjustBalance,
  createTransaction,
  deleteTransactions,
  purgeTransactions,
  restoreTransactions,
  setCanceled,
  settleTransactions,
  unsettleTransactions,
  updateTransaction,
} from "./service";

/** Lançamentos aparecem em quase todas as telas: revalida o app inteiro. */
function refresh() {
  revalidatePath("/", "layout");
}

export const createTransactionAction = authActionClient
  .metadata({ name: "transactions.create" })
  .inputSchema(createTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const created = await createTransaction(ctx.app, parsedInput, ctx.app.today);
    refresh();
    return { id: created.id };
  });

export const updateTransactionAction = authActionClient
  .metadata({ name: "transactions.update" })
  .inputSchema(updateTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await updateTransaction(ctx.app, parsedInput);
    refresh();
  });

export const settleTransactionsAction = authActionClient
  .metadata({ name: "transactions.settle" })
  .inputSchema(settleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const count = await settleTransactions(ctx.app, parsedInput);
    refresh();
    return { count };
  });

export const unsettleTransactionsAction = authActionClient
  .metadata({ name: "transactions.unsettle" })
  .inputSchema(idsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const count = await unsettleTransactions(ctx.app, parsedInput.ids);
    refresh();
    return { count };
  });

export const setCanceledAction = authActionClient
  .metadata({ name: "transactions.setCanceled" })
  .inputSchema(idsSchema.extend({ canceled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const count = await setCanceled(ctx.app, parsedInput.ids, parsedInput.canceled);
    refresh();
    return { count };
  });

export const deleteTransactionsAction = authActionClient
  .metadata({ name: "transactions.delete" })
  .inputSchema(deleteTransactionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const count = await deleteTransactions(ctx.app, parsedInput.ids, parsedInput.scope);
    refresh();
    return { count };
  });

export const restoreTransactionsAction = authActionClient
  .metadata({ name: "transactions.restore" })
  .inputSchema(idsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const count = await restoreTransactions(ctx.app, parsedInput.ids);
    refresh();
    return { count };
  });

export const purgeTransactionsAction = authActionClient
  .metadata({ name: "transactions.purge" })
  .inputSchema(idsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const count = await purgeTransactions(ctx.app, parsedInput.ids);
    refresh();
    return { count };
  });

export const adjustBalanceAction = authActionClient
  .metadata({ name: "transactions.adjustBalance" })
  .inputSchema(balanceAdjustmentSchema)
  .action(async ({ parsedInput, ctx }) => {
    await adjustBalance(ctx.app, parsedInput);
    refresh();
  });

export const suggestDescriptionsAction = authActionClient
  .metadata({ name: "transactions.suggest", permission: "read" })
  .inputSchema(z.object({ q: z.string().max(80) }))
  .action(async ({ parsedInput, ctx }) => suggestDescriptions(ctx.app, parsedInput.q));
