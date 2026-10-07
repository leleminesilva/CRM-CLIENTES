"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { idInput } from "@fin/lib/validation";
import {
  createCardSchema,
  moveItemSchema,
  payInvoiceSchema,
  reconcileSchema,
  updateCardSchema,
} from "./schemas";
import {
  createCard,
  deleteCard,
  moveToInvoice,
  payInvoice,
  reconcileInvoice,
  setCardArchived,
  undoInvoicePayments,
  updateCard,
} from "./service";

const refresh = () => revalidatePath("/", "layout");

export const createCardAction = authActionClient
  .metadata({ name: "cards.create" })
  .inputSchema(createCardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const c = await createCard(ctx.app, parsedInput);
    refresh();
    return { id: c.id };
  });

export const updateCardAction = authActionClient
  .metadata({ name: "cards.update" })
  .inputSchema(updateCardSchema)
  .action(async ({ parsedInput, ctx }) => {
    await updateCard(ctx.app, parsedInput);
    refresh();
  });

export const setCardArchivedAction = authActionClient
  .metadata({ name: "cards.setArchived" })
  .inputSchema(z.object({ id: z.string().uuid(), archived: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setCardArchived(ctx.app, parsedInput.id, parsedInput.archived);
    refresh();
  });

export const deleteCardAction = authActionClient
  .metadata({ name: "cards.delete" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    await deleteCard(ctx.app, parsedInput.id);
    refresh();
  });

export const payInvoiceAction = authActionClient
  .metadata({ name: "invoices.pay" })
  .inputSchema(payInvoiceSchema)
  .action(async ({ parsedInput, ctx }) => {
    await payInvoice(ctx.app, parsedInput, ctx.app.today);
    refresh();
  });

export const undoInvoicePaymentsAction = authActionClient
  .metadata({ name: "invoices.undoPayments" })
  .inputSchema(z.object({ invoiceId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await undoInvoicePayments(ctx.app, parsedInput.invoiceId, ctx.app.today);
    refresh();
  });

export const reconcileInvoiceAction = authActionClient
  .metadata({ name: "invoices.reconcile" })
  .inputSchema(reconcileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const r = await reconcileInvoice(ctx.app, parsedInput, ctx.app.today);
    refresh();
    return r;
  });

export const moveToInvoiceAction = authActionClient
  .metadata({ name: "invoices.moveItem" })
  .inputSchema(moveItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    await moveToInvoice(ctx.app, parsedInput, ctx.app.today);
    refresh();
  });
