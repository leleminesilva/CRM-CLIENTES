"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@fin/lib/db";
import { authActionClient } from "@fin/lib/safe-action";

export const dismissOnboardingAction = authActionClient
  .metadata({ name: "onboarding.dismiss" })
  .action(async ({ ctx }) => {
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: ctx.app.workspaceId },
      select: { settings: true },
    });
    await prisma.workspace.update({
      where: { id: ctx.app.workspaceId },
      data: { settings: { ...((ws.settings ?? {}) as object), onboardingDismissed: true } },
    });
    revalidatePath("/financeiro/painel");
  });
