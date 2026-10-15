import { ensureSystemCategory } from "@fin/crm/categorias";
import { audit } from "@fin/lib/audit";
import { toDbDate } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import type { ChequeInput } from "./schemas";

export const CHEQUE_ISSUED_KEY = "cheque_issued";
export const CHEQUE_RECEIVED_KEY = "cheque_received";

/** Categorias de sistema: "Cheques emitidos" (despesa) e "Cheques recebidos" (receita). */
function chequeCategory(db: DbClient, workspaceId: string, direction: "ISSUED" | "RECEIVED") {
  return direction === "ISSUED"
    ? ensureSystemCategory(db, workspaceId, {
        systemKey: CHEQUE_ISSUED_KEY,
        create: {
          kind: "EXPENSE",
          name: "Cheques emitidos",
          icon: "receipt",
          color: "#f59e0b",
          defaultNature: "VARIABLE",
        },
      })
    : ensureSystemCategory(db, workspaceId, {
        systemKey: CHEQUE_RECEIVED_KEY,
        create: {
          kind: "INCOME",
          name: "Cheques recebidos",
          icon: "wallet",
          color: "#10b981",
          incomeClass: "OTHER",
        },
      });
}

async function assertAccount(db: DbClient, ctx: ServiceContext, id: string | null) {
  if (!id) return;
  const a = await db.account.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!a) throw new AppError("NOT_FOUND", "Conta não encontrada.");
}

function txFields(input: ChequeInput) {
  return {
    description: `Cheque ${input.number} · ${input.party}`,
    notes: input.notes,
    amount: input.amount,
    date: toDbDate(input.issueDate),
    dueDate: toDbDate(input.dueDate),
    accountId: input.accountId,
  };
}

/** Registra o cheque e cria o lançamento a pagar (emitido) ou a receber (recebido) no "bom para". */
export async function createCheque(ctx: ServiceContext, input: ChequeInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    await assertAccount(tx, ctx, input.accountId);
    const category = await chequeCategory(tx, ctx.workspaceId, input.direction);
    const transaction = await tx.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: input.direction === "ISSUED" ? "EXPENSE" : "INCOME",
        ...(input.direction === "ISSUED" ? { nature: "VARIABLE" as const } : {}),
        categoryId: category.id,
        paymentMethod: null,
        status: "PENDING",
        settledAt: null,
        ...txFields(input),
      },
    });
    const cheque = await tx.cheque.create({
      data: {
        workspaceId: ctx.workspaceId,
        direction: input.direction,
        number: input.number,
        bank: input.bank,
        party: input.party,
        issueDate: toDbDate(input.issueDate),
        notes: input.notes,
        transactionId: transaction.id,
      },
    });
    await audit(tx, ctx, { action: "cheque.create", entityType: "Cheque", entityId: cheque.id, after: cheque });
    return cheque;
  });
}

async function getOwned(db: DbClient, ctx: ServiceContext, id: string) {
  const c = await db.cheque.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: { transaction: true },
  });
  if (!c) throw new AppError("NOT_FOUND");
  return c;
}

export async function updateCheque(ctx: ServiceContext, id: string, input: ChequeInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwned(tx, ctx, id);
    await assertAccount(tx, ctx, input.accountId);
    // Valor e data de um cheque já compensado não mudam por aqui (o saldo da conta já foi movido).
    const settled = before.transaction.status === "SETTLED";
    await tx.transaction.update({
      where: { id: before.transactionId },
      data: settled
        ? { description: `Cheque ${input.number} · ${input.party}`, notes: input.notes }
        : txFields(input),
    });
    const after = await tx.cheque.update({
      where: { id },
      data: {
        number: input.number,
        bank: input.bank,
        party: input.party,
        issueDate: toDbDate(input.issueDate),
        notes: input.notes,
      },
    });
    await audit(tx, ctx, { action: "cheque.update", entityType: "Cheque", entityId: id, before, after });
    return after;
  });
}

/** Cheque devolvido pelo banco: o lançamento fica cancelado (não conta no saldo nem no fluxo). */
export async function setChequeBounced(ctx: ServiceContext, id: string, bounced: boolean) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const c = await getOwned(tx, ctx, id);
    await tx.transaction.update({
      where: { id: c.transactionId },
      data: bounced ? { status: "CANCELED", settledAt: null } : { status: "PENDING", settledAt: null },
    });
    await tx.cheque.update({ where: { id }, data: { bounced } });
    await audit(tx, ctx, {
      action: bounced ? "cheque.bounce" : "cheque.unbounce",
      entityType: "Cheque",
      entityId: id,
    });
  });
}

export async function deleteCheque(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const c = await getOwned(tx, ctx, id);
    await tx.cheque.delete({ where: { id } });
    await tx.attachment.deleteMany({ where: { transactionId: c.transactionId } });
    await tx.transaction.delete({ where: { id: c.transactionId } });
    await audit(tx, ctx, { action: "cheque.delete", entityType: "Cheque", entityId: id, before: c });
  });
}
