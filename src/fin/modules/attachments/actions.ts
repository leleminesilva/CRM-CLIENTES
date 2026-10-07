"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { deleteAttachment, listTransactionAttachments } from "./service";

export const listAttachmentsAction = authActionClient
  .metadata({ name: "attachments.list", permission: "read" })
  .inputSchema(z.object({ transactionId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) =>
    listTransactionAttachments(ctx.app, parsedInput.transactionId),
  );

export const deleteAttachmentAction = authActionClient
  .metadata({ name: "attachments.delete" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteAttachment(ctx.app, parsedInput.id);
    revalidatePath("/", "layout");
  });
