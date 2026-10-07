"use server";

// No CRM há um único workspace (o da empresa): sem troca de workspace nem workspace de demonstração.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { deleteWorkspace, renameWorkspace } from "./service";

export const renameWorkspaceAction = authActionClient
  .metadata({ name: "workspace.rename", permission: "manage" })
  .inputSchema(
    z.object({ name: z.string().trim().min(1, "Informe o nome").max(60, "Use até 60 caracteres") }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await renameWorkspace(ctx.app, parsedInput.name);
    revalidatePath("/", "layout");
  });

export const deleteWorkspaceAction = authActionClient
  .metadata({ name: "workspace.delete", permission: "read" })
  .inputSchema(z.object({ workspaceId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteWorkspace(ctx.app, parsedInput.workspaceId);
    revalidatePath("/", "layout");
  });
