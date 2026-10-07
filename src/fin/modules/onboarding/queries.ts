import { prisma } from "@fin/lib/db";
import type { ServiceContext } from "@fin/lib/permissions";

export interface OnboardingStep {
  key: "account" | "card" | "income" | "fixed" | "installments";
  done: boolean;
  optional: boolean;
}

/** Primeiros passos derivados dos dados (nada a "marcar"): some quando concluído ou dispensado. */
export async function onboardingState(ctx: ServiceContext) {
  const [workspace, accounts, cards, baseIncome, fixed, plans] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: ctx.workspaceId },
      select: { settings: true, isDemo: true },
    }),
    prisma.account.count({ where: { workspaceId: ctx.workspaceId, archivedAt: null } }),
    prisma.creditCard.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.recurrence.count({
      where: { workspaceId: ctx.workspaceId, deletedAt: null, type: "INCOME" },
    }),
    prisma.recurrence.count({
      where: { workspaceId: ctx.workspaceId, deletedAt: null, type: "EXPENSE", nature: "FIXED" },
    }),
    prisma.installmentPlan.count({ where: { workspaceId: ctx.workspaceId } }),
  ]);
  const settings = (workspace.settings ?? {}) as { onboardingDismissed?: boolean };
  const steps: OnboardingStep[] = [
    { key: "account", done: accounts > 0, optional: false },
    { key: "card", done: cards > 0, optional: true },
    { key: "income", done: baseIncome > 0, optional: false },
    { key: "fixed", done: fixed > 0, optional: false },
    { key: "installments", done: plans > 0, optional: true },
  ];
  const required = steps.filter((s) => !s.optional);
  return {
    steps,
    visible: !workspace.isDemo && !settings.onboardingDismissed && !required.every((s) => s.done),
    completed: steps.filter((s) => s.done).length,
  };
}
