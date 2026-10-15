"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { chequeSchema, updateChequeSchema } from "./schemas";
import { createCheque, deleteCheque, setChequeBounced, updateCheque } from "./service";

const refresh = () => revalidatePath("/", "layout");

export const createChequeAction = authActionClient
  .metadata({ name: "cheques.create" })
  .inputSchema(chequeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const c = await createCheque(ctx.app, parsedInput);
    refresh();
    return { id: c.id };
  });

export const updateChequeAction = authActionClient
  .metadata({ name: "cheques.update" })
  .inputSchema(updateChequeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...input } = parsedInput;
    await updateCheque(ctx.app, id, input);
    refresh();
  });

export const setChequeBouncedAction = authActionClient
  .metadata({ name: "cheques.setBounced" })
  .inputSchema(z.object({ id: z.string().uuid(), bounced: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setChequeBounced(ctx.app, parsedInput.id, parsedInput.bounced);
    refresh();
  });

export const deleteChequeAction = authActionClient
  .metadata({ name: "cheques.delete" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteCheque(ctx.app, parsedInput.id);
    refresh();
  });
