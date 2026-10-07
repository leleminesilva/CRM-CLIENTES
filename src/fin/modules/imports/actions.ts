"use server";

import { revalidatePath } from "next/cache";
import { authActionClient } from "@fin/lib/safe-action";
import { commitImportSchema, previewImportSchema, rollbackImportSchema } from "./schemas";
import { commitImport, previewImport, rollbackImport } from "./service";

export const previewImportAction = authActionClient
  .metadata({ name: "imports.preview" })
  .inputSchema(previewImportSchema)
  .action(async ({ parsedInput, ctx }) => previewImport(ctx.app, parsedInput));

export const commitImportAction = authActionClient
  .metadata({ name: "imports.commit" })
  .inputSchema(commitImportSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await commitImport(ctx.app, parsedInput);
    revalidatePath("/", "layout");
    return result;
  });

export const rollbackImportAction = authActionClient
  .metadata({ name: "imports.rollback" })
  .inputSchema(rollbackImportSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await rollbackImport(ctx.app, parsedInput.id);
    revalidatePath("/", "layout");
    return result;
  });
