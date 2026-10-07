import { audit } from "@fin/lib/audit";
import { type ISODate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import type { AssetInput, LiabilityInput } from "./schemas";

export async function createAsset(ctx: ServiceContext, input: AssetInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: input.name,
        kind: input.kind,
        acquisitionDate: input.acquisitionDate ? toDbDate(input.acquisitionDate) : null,
        acquisitionValue: input.acquisitionValue,
        currentValue: input.currentValue,
        valuedAt: toDbDate(input.valuedAt),
        notes: input.notes,
        valuations: { create: { date: toDbDate(input.valuedAt), value: input.currentValue } },
      },
    });
    await audit(tx, ctx, {
      action: "asset.create",
      entityType: "Asset",
      entityId: asset.id,
      after: asset,
    });
    return asset;
  });
}

async function ownedAsset(ctx: ServiceContext, id: string) {
  const a = await prisma.asset.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!a) throw new AppError("NOT_FOUND");
  return a;
}

export async function updateAsset(ctx: ServiceContext, id: string, input: AssetInput) {
  assertCan(ctx, "write");
  const before = await ownedAsset(ctx, id);
  const after = await prisma.asset.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      acquisitionDate: input.acquisitionDate ? toDbDate(input.acquisitionDate) : null,
      acquisitionValue: input.acquisitionValue,
      notes: input.notes,
    },
  });
  await audit(prisma, ctx, {
    action: "asset.update",
    entityType: "Asset",
    entityId: id,
    before,
    after,
  });
}

/** Nova avaliação: o histórico guarda cada valor com a sua data (o patrimônio passado não muda). */
export async function revalueAsset(ctx: ServiceContext, id: string, value: string, date: ISODate) {
  assertCan(ctx, "write");
  await ownedAsset(ctx, id);
  await prisma.$transaction(async (tx) => {
    await tx.assetValuation.upsert({
      where: { assetId_date: { assetId: id, date: toDbDate(date) } },
      create: { assetId: id, date: toDbDate(date), value },
      update: { value },
    });
    const latest = await tx.assetValuation.findFirstOrThrow({
      where: { assetId: id },
      orderBy: { date: "desc" },
    });
    await tx.asset.update({
      where: { id },
      data: { currentValue: latest.value, valuedAt: latest.date },
    });
    await audit(tx, ctx, {
      action: "asset.revalue",
      entityType: "Asset",
      entityId: id,
      after: { value, date },
    });
  });
}

export async function archiveAsset(ctx: ServiceContext, id: string, archived: boolean) {
  assertCan(ctx, "write");
  await ownedAsset(ctx, id);
  await prisma.asset.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(prisma, ctx, {
    action: archived ? "asset.archive" : "asset.unarchive",
    entityType: "Asset",
    entityId: id,
  });
}

export async function deleteAsset(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  const a = await ownedAsset(ctx, id);
  await prisma.asset.delete({ where: { id } });
  await audit(prisma, ctx, {
    action: "asset.delete",
    entityType: "Asset",
    entityId: id,
    before: a,
  });
}

const liabilityData = (input: LiabilityInput) => ({
  name: input.name,
  kind: input.kind,
  creditor: input.creditor,
  originalAmount: input.originalAmount,
  currentBalance: input.currentBalance,
  balanceUpdatedAt: toDbDate(input.startDate),
  startDate: toDbDate(input.startDate),
  endDate: input.endDate ? toDbDate(input.endDate) : null,
  notes: input.notes,
});

export async function createLiability(ctx: ServiceContext, input: LiabilityInput, today: ISODate) {
  assertCan(ctx, "write");
  const l = await prisma.liability.create({
    data: {
      workspaceId: ctx.workspaceId,
      ...liabilityData(input),
      balanceUpdatedAt: toDbDate(today),
    },
  });
  await audit(prisma, ctx, {
    action: "liability.create",
    entityType: "Liability",
    entityId: l.id,
    after: l,
  });
  return l;
}

export async function updateLiability(
  ctx: ServiceContext,
  id: string,
  input: LiabilityInput,
  today: ISODate,
) {
  assertCan(ctx, "write");
  const before = await prisma.liability.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!before) throw new AppError("NOT_FOUND");
  const after = await prisma.liability.update({
    where: { id },
    data: { ...liabilityData(input), balanceUpdatedAt: toDbDate(today) },
  });
  await audit(prisma, ctx, {
    action: "liability.update",
    entityType: "Liability",
    entityId: id,
    before,
    after,
  });
}

export async function deleteLiability(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  const before = await prisma.liability.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!before) throw new AppError("NOT_FOUND");
  await prisma.liability.delete({ where: { id } });
  await audit(prisma, ctx, {
    action: "liability.delete",
    entityType: "Liability",
    entityId: id,
    before,
  });
}
