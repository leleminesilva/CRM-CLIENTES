import { audit } from "@fin/lib/audit";
import { toDbDate } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import type { CreateGoalInput } from "./schemas";

async function owned(db: DbClient, ctx: ServiceContext, id: string) {
  const g = await db.goal.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!g) throw new AppError("NOT_FOUND");
  return g;
}

async function assertAccount(db: DbClient, ctx: ServiceContext, id: string | null) {
  if (id && !(await db.account.findFirst({ where: { id, workspaceId: ctx.workspaceId } })))
    throw new AppError("NOT_FOUND", "Conta não encontrada.");
}

async function assertSingleEmergencyFund(
  db: DbClient,
  ctx: ServiceContext,
  kind: string,
  excludeId?: string,
) {
  if (kind !== "EMERGENCY_FUND") return;
  const existing = await db.goal.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      kind: "EMERGENCY_FUND",
      status: { not: "ARCHIVED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) throw new AppError("EMERGENCY_FUND_EXISTS");
}

function data(input: CreateGoalInput) {
  return {
    name: input.name,
    kind: input.kind,
    targetAmount: input.targetAmount,
    initialAmount: input.initialAmount,
    targetDate: input.targetMonth ? toDbDate(`${input.targetMonth}-01`) : null,
    linkedAccountId: input.linkedAccountId,
    color: input.color,
    notes: input.notes,
  };
}

export async function createGoal(ctx: ServiceContext, input: CreateGoalInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    await assertAccount(tx, ctx, input.linkedAccountId);
    await assertSingleEmergencyFund(tx, ctx, input.kind);
    const sortOrder =
      ((
        await tx.goal.aggregate({
          where: { workspaceId: ctx.workspaceId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) + 1;
    const goal = await tx.goal.create({
      data: { workspaceId: ctx.workspaceId, ...data(input), sortOrder },
    });
    await audit(tx, ctx, {
      action: "goal.create",
      entityType: "Goal",
      entityId: goal.id,
      after: goal,
    });
    return goal;
  });
}

export async function updateGoal(ctx: ServiceContext, id: string, input: CreateGoalInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await owned(tx, ctx, id);
    await assertAccount(tx, ctx, input.linkedAccountId);
    await assertSingleEmergencyFund(tx, ctx, input.kind, id);
    const after = await tx.goal.update({ where: { id }, data: data(input) });
    await audit(tx, ctx, {
      action: "goal.update",
      entityType: "Goal",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function setGoalStatus(
  ctx: ServiceContext,
  id: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const g = await owned(tx, ctx, id);
    if (status === "ACTIVE" || status === "PAUSED")
      await assertSingleEmergencyFund(tx, ctx, g.kind, id);
    await tx.goal.update({ where: { id }, data: { status } });
    await audit(tx, ctx, {
      action: `goal.${status.toLowerCase()}`,
      entityType: "Goal",
      entityId: id,
      after: { status },
    });
  });
}

export async function deleteGoal(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const g = await owned(tx, ctx, id);
    await tx.goal.delete({ where: { id } });
    await audit(tx, ctx, { action: "goal.delete", entityType: "Goal", entityId: id, before: g });
  });
}

export async function addContribution(
  ctx: ServiceContext,
  input: { goalId: string; amount: string; date: string; notes: string | null },
) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const g = await owned(tx, ctx, input.goalId);
    if (g.linkedAccountId) throw new AppError("GOAL_LINKED");
    const c = await tx.goalContribution.create({
      data: {
        workspaceId: ctx.workspaceId,
        goalId: g.id,
        amount: input.amount,
        date: toDbDate(input.date),
        notes: input.notes,
      },
    });
    await audit(tx, ctx, {
      action: "goal.contribute",
      entityType: "Goal",
      entityId: g.id,
      after: { amount: input.amount, date: input.date },
    });
    return c;
  });
}

export async function deleteContribution(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  const c = await prisma.goalContribution.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!c) throw new AppError("NOT_FOUND");
  await prisma.goalContribution.delete({ where: { id } });
}
