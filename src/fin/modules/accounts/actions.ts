"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { idInput } from "@fin/lib/validation";
import { createAccountSchema, reorderAccountsSchema, updateAccountSchema } from "./schemas";
import {
  createAccount,
  deleteAccount,
  reorderAccounts,
  setAccountArchived,
  startBalanceAtEarliest,
  updateAccount,
} from "./service";

const PATH = "/financeiro/contas";

export const createAccountAction = authActionClient
  .metadata({ name: "accounts.create" })
  .inputSchema(createAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    const created = await createAccount(ctx.app, parsedInput);
    revalidatePath(PATH);
    return { id: created.id };
  });

export const updateAccountAction = authActionClient
  .metadata({ name: "accounts.update" })
  .inputSchema(updateAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    await updateAccount(ctx.app, parsedInput);
    revalidatePath(PATH);
  });

export const setAccountArchivedAction = authActionClient
  .metadata({ name: "accounts.setArchived" })
  .inputSchema(z.object({ id: z.string().uuid(), archived: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setAccountArchived(ctx.app, parsedInput.id, parsedInput.archived);
    revalidatePath(PATH);
  });

export const deleteAccountAction = authActionClient
  .metadata({ name: "accounts.delete" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    await deleteAccount(ctx.app, parsedInput.id);
    revalidatePath(PATH);
  });

export const reorderAccountsAction = authActionClient
  .metadata({ name: "accounts.reorder" })
  .inputSchema(reorderAccountsSchema)
  .action(async ({ parsedInput, ctx }) => {
    await reorderAccounts(ctx.app, parsedInput.orderedIds);
    revalidatePath(PATH);
  });

export const startBalanceAtEarliestAction = authActionClient
  .metadata({ name: "accounts.startBalanceAtEarliest" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    const result = await startBalanceAtEarliest(ctx.app, parsedInput.id);
    revalidatePath("/", "layout");
    return result;
  });
