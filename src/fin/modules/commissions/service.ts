import { audit } from "@fin/lib/audit";
import { toDbDate } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { computeCommission } from "./domain/commission";
import type { CommissionInput } from "./schemas";

async function commissionCategory(db: DbClient, workspaceId: string) {
  const c = await db.category.findFirst({ where: { workspaceId, systemKey: "commission" } });
  if (!c) throw new AppError("NOT_FOUND", "Categoria de comissões não encontrada.");
  return c;
}

async function assertAccount(db: DbClient, ctx: ServiceContext, id: string | null) {
  if (!id) return;
  if (!(await db.account.findFirst({ where: { id, workspaceId: ctx.workspaceId } })))
    throw new AppError("NOT_FOUND", "Conta não encontrada.");
}

function txFields(input: CommissionInput, amount: string) {
  return {
    description: `Comissão: ${input.clientName}`,
    notes: input.notes,
    amount,
    date: toDbDate(input.saleDate),
    dueDate: toDbDate(input.expectedDate),
    status: input.received ? ("SETTLED" as const) : ("PENDING" as const),
    settledAt: input.received ? toDbDate(input.receivedAt ?? input.expectedDate) : null,
    accountId: input.accountId,
  };
}

/** Registra a venda e cria a receita a receber correspondente (fonte única para o fluxo de caixa). */
export async function createCommission(ctx: ServiceContext, input: CommissionInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    await assertAccount(tx, ctx, input.accountId);
    const category = await commissionCategory(tx, ctx.workspaceId);
    const amount =
      input.amountOverride ?? computeCommission(input.saleAmount, input.ratePercent).toFixed(2);
    const transaction = await tx.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: "INCOME",
        categoryId: category.id,
        paymentMethod: null,
        ...txFields(input, amount),
      },
    });
    const commission = await tx.commission.create({
      data: {
        workspaceId: ctx.workspaceId,
        transactionId: transaction.id,
        clientName: input.clientName,
        saleDescription: input.saleDescription,
        saleAmount: input.saleAmount,
        ratePercent: input.ratePercent,
        isAmountOverridden: input.amountOverride !== null,
        saleDate: toDbDate(input.saleDate),
        notes: input.notes,
      },
    });
    await audit(tx, ctx, {
      action: "commission.create",
      entityType: "Commission",
      entityId: commission.id,
      after: { ...commission, amount },
    });
    return commission;
  });
}

async function getOwned(db: DbClient, ctx: ServiceContext, id: string) {
  const c = await db.commission.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: { transaction: true },
  });
  if (!c) throw new AppError("NOT_FOUND");
  return c;
}

export async function updateCommission(ctx: ServiceContext, id: string, input: CommissionInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwned(tx, ctx, id);
    await assertAccount(tx, ctx, input.accountId);
    const amount =
      input.amountOverride ?? computeCommission(input.saleAmount, input.ratePercent).toFixed(2);
    const keepCanceled = before.transaction.status === "CANCELED";
    await tx.transaction.update({
      where: { id: before.transactionId },
      data: {
        ...txFields(input, amount),
        ...(keepCanceled ? { status: "CANCELED" as const, settledAt: null } : {}),
      },
    });
    const after = await tx.commission.update({
      where: { id },
      data: {
        clientName: input.clientName,
        saleDescription: input.saleDescription,
        saleAmount: input.saleAmount,
        ratePercent: input.ratePercent,
        isAmountOverridden: input.amountOverride !== null,
        saleDate: toDbDate(input.saleDate),
        notes: input.notes,
      },
    });
    await audit(tx, ctx, {
      action: "commission.update",
      entityType: "Commission",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

/** Venda desfeita: a comissão fica no histórico como cancelada (não entra em totais). */
export async function setCommissionCanceled(ctx: ServiceContext, id: string, canceled: boolean) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const c = await getOwned(tx, ctx, id);
    await tx.transaction.update({
      where: { id: c.transactionId },
      data: canceled ? { status: "CANCELED", settledAt: null } : { status: "PENDING" },
    });
    await audit(tx, ctx, {
      action: canceled ? "commission.cancel" : "commission.reactivate",
      entityType: "Commission",
      entityId: id,
    });
  });
}

export async function deleteCommission(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const c = await getOwned(tx, ctx, id);
    await tx.commission.delete({ where: { id } });
    await tx.attachment.deleteMany({ where: { transactionId: c.transactionId } });
    await tx.transaction.delete({ where: { id: c.transactionId } });
    await audit(tx, ctx, {
      action: "commission.delete",
      entityType: "Commission",
      entityId: id,
      before: c,
    });
  });
}
