import type { Account } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { fromDbDate, toDbDate } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError, normalizeError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { accountRepository as repo } from "./repository";
import type { CreateAccountInput, UpdateAccountInput } from "./schemas";

async function getOwned(db: DbClient, ctx: ServiceContext, id: string): Promise<Account> {
  const account = await repo.findById(db, ctx.workspaceId, id);
  if (!account) throw new AppError("NOT_FOUND");
  return account;
}

async function assertNameAvailable(
  db: DbClient,
  ctx: ServiceContext,
  name: string,
  excludeId?: string,
) {
  if (await repo.findByName(db, ctx.workspaceId, name, excludeId))
    throw new AppError("ACCOUNT_NAME_TAKEN");
}

function rethrowNameConflict(error: unknown): never {
  const normalized = normalizeError(error);
  if (normalized instanceof AppError && normalized.code === "CONFLICT")
    throw new AppError("ACCOUNT_NAME_TAKEN");
  throw normalized;
}

function toData(input: CreateAccountInput) {
  return {
    name: input.name,
    type: input.type,
    institution: input.institution,
    initialBalance: input.initialBalance,
    initialBalanceDate: toDbDate(input.initialBalanceDate),
    isLiquid: input.isLiquid,
    includeInNetWorth: input.includeInNetWorth,
    color: input.color,
  };
}

export async function createAccount(ctx: ServiceContext, input: CreateAccountInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    await assertNameAvailable(tx, ctx, input.name);
    const created = await tx.account
      .create({
        data: {
          workspaceId: ctx.workspaceId,
          ...toData(input),
          sortOrder: await repo.nextSortOrder(tx, ctx.workspaceId),
        },
      })
      .catch(rethrowNameConflict);
    await audit(tx, ctx, {
      action: "account.create",
      entityType: "Account",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateAccount(ctx: ServiceContext, input: UpdateAccountInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwned(tx, ctx, input.id);
    await assertNameAvailable(tx, ctx, input.name, before.id);
    const after = await tx.account
      .update({ where: { id: before.id }, data: toData(input) })
      .catch(rethrowNameConflict);
    await audit(tx, ctx, {
      action: "account.update",
      entityType: "Account",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

export async function setAccountArchived(ctx: ServiceContext, id: string, archived: boolean) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    await getOwned(tx, ctx, id);
    await tx.account.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(tx, ctx, {
      action: archived ? "account.archive" : "account.unarchive",
      entityType: "Account",
      entityId: id,
    });
  });
}

/** Excluir só contas sem nenhum vínculo; com histórico, o caminho é arquivar. */
export async function deleteAccount(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const account = await getOwned(tx, ctx, id);
    if ((await repo.references(tx, id)) > 0) throw new AppError("ACCOUNT_HAS_TRANSACTIONS");
    await tx.account.delete({ where: { id } });
    await audit(tx, ctx, {
      action: "account.delete",
      entityType: "Account",
      entityId: id,
      before: account,
    });
  });
}

export async function reorderAccounts(ctx: ServiceContext, orderedIds: string[]) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const owned = await tx.account.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    const known = new Set(owned.map((a) => a.id));
    if (orderedIds.some((id) => !known.has(id))) throw new AppError("NOT_FOUND");
    for (const [index, id] of orderedIds.entries()) {
      await tx.account.update({ where: { id }, data: { sortOrder: index } });
    }
  });
}

/**
 * Passa a contar o saldo inicial a partir do primeiro lançamento pago antes dele: o valor do saldo
 * inicial vira o saldo daquele dia e os lançamentos anteriores entram no saldo.
 */
export async function startBalanceAtEarliest(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwned(tx, ctx, id);
    const earliest = (await repo.beforeStart(tx, ctx.workspaceId)).get(id)?.earliest;
    if (!earliest)
      throw new AppError("CONFLICT", "Todos os lançamentos desta conta já entram no saldo.");
    const after = await tx.account.update({
      where: { id },
      data: { initialBalanceDate: earliest },
    });
    await audit(tx, ctx, {
      action: "account.update",
      entityType: "Account",
      entityId: id,
      before,
      after,
    });
    return { initialBalanceDate: fromDbDate(earliest) };
  });
}
