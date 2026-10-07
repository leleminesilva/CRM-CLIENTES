import type { Transaction } from "@prisma/client";
import type { ExpenseNature } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { addDays, fromDbDate, type ISODate, toDbDate, todayISO } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { toMoney } from "@fin/lib/money";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { storage } from "@fin/lib/storage";
import { accountRepository } from "@fin/modules/accounts/repository";
import {
  getOwnedCard,
  invoiceForPurchase,
  refreshInvoiceStatus,
} from "@fin/modules/credit-cards/service";
import {
  applyTemplateToSeries,
  createRecurrence,
  endSeries,
  getOwnedRecurrence,
  type RecurrenceTemplate,
} from "@fin/modules/recurrences/service";
import type { CreateTransactionInput, UpdateTransactionInput } from "./schemas";

/** Tipos que o livro-caixa edita diretamente (pagamento de fatura e parcelas têm módulos próprios). */
const EDITABLE_TYPES = new Set(["INCOME", "EXPENSE", "TRANSFER", "REFUND"]);

async function getOwned(
  db: DbClient,
  ctx: ServiceContext,
  id: string,
  opts: { includeDeleted?: boolean } = {},
) {
  const t = await db.transaction.findFirst({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      ...(opts.includeDeleted ? {} : { deletedAt: null }),
    },
  });
  if (!t) throw new AppError("NOT_FOUND");
  return t;
}

/** Valida que conta(s) e categoria pertencem ao workspace, estão ativas e combinam com o tipo. */
async function validateReferences(
  db: DbClient,
  ctx: ServiceContext,
  input: Pick<CreateTransactionInput, "type" | "accountId" | "transferAccountId" | "categoryId">,
  current?: Pick<Transaction, "accountId" | "transferAccountId" | "categoryId">,
) {
  for (const [field, id] of [
    ["accountId", input.accountId],
    ["transferAccountId", input.type === "TRANSFER" ? input.transferAccountId : null],
  ] as const) {
    if (!id) continue;
    const account = await accountRepository.findById(db, ctx.workspaceId, id);
    if (!account) throw new AppError("NOT_FOUND", "Conta não encontrada.");
    if (account.archivedAt && current?.[field] !== id) throw new AppError("ACCOUNT_ARCHIVED");
  }
  if (input.type !== "TRANSFER" && input.categoryId) {
    const category = await db.category.findFirst({
      where: { id: input.categoryId, workspaceId: ctx.workspaceId },
    });
    if (!category) throw new AppError("NOT_FOUND", "Categoria não encontrada.");
    if (category.kind !== input.type) throw new AppError("CATEGORY_KIND_MISMATCH");
    if (category.archivedAt && current?.categoryId !== category.id)
      throw new AppError("CATEGORY_ARCHIVED");
    return category;
  }
  return null;
}

function resolveNature(
  type: CreateTransactionInput["type"],
  chosen: ExpenseNature | null,
  categoryDefault: ExpenseNature | null | undefined,
  recurring: boolean,
): ExpenseNature | null {
  if (type !== "EXPENSE") return null;
  return chosen ?? categoryDefault ?? (recurring ? "FIXED" : "VARIABLE");
}

function ledgerFields(
  input: CreateTransactionInput | UpdateTransactionInput,
  nature: ExpenseNature | null,
) {
  const dueDate = input.dueDate ?? input.date;
  const settled = input.settled;
  return {
    type: input.type,
    description: input.description,
    amount: input.amount,
    date: toDbDate(input.date),
    dueDate: toDbDate(dueDate),
    status: settled ? ("SETTLED" as const) : ("PENDING" as const),
    settledAt: settled ? toDbDate(input.settledAt ?? input.date) : null,
    accountId: input.accountId,
    transferAccountId: input.type === "TRANSFER" ? input.transferAccountId : null,
    categoryId: input.type === "TRANSFER" ? null : input.categoryId,
    nature,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
  };
}

function templateOf(
  input: CreateTransactionInput | UpdateTransactionInput,
  nature: ExpenseNature | null,
): RecurrenceTemplate {
  return {
    type: input.type === "INCOME" ? "INCOME" : "EXPENSE",
    description: input.description,
    amount: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    creditCardId: input.creditCardId,
    paymentMethod: input.paymentMethod,
    nature,
  };
}

/**
 * Compra no cartão: cai na fatura do ciclo, vence com ela e fica pendente até a fatura ser paga
 * (o dinheiro só sai da conta no pagamento da fatura — regra R3). Sem cartão, desfaz o vínculo.
 */
async function cardFields(
  db: DbClient,
  ctx: ServiceContext,
  input: CreateTransactionInput | UpdateTransactionInput,
  current?: Transaction,
) {
  if (input.type !== "EXPENSE" || !input.creditCardId) {
    return { creditCardId: null, invoiceId: null } as const;
  }
  const card = await getOwnedCard(db, ctx, input.creditCardId);
  if (card.archivedAt && current?.creditCardId !== card.id) throw new AppError("CARD_ARCHIVED");
  const sameInvoiceSpot =
    current?.creditCardId === card.id &&
    current.invoiceId &&
    fromDbDate(current.date) === input.date;
  const invoice = sameInvoiceSpot
    ? await db.creditCardInvoice.findUniqueOrThrow({ where: { id: current.invoiceId! } })
    : await invoiceForPurchase(db, card, input.date);
  if (sameInvoiceSpot && invoice.status === "PAID") throw new AppError("INVOICE_PAID");
  return {
    creditCardId: card.id,
    invoiceId: invoice.id,
    dueDate: invoice.dueDate,
    accountId: null,
    status: "PENDING" as const,
    settledAt: null,
  };
}

async function assertNotInPaidInvoice(db: DbClient, rows: { invoiceId: string | null }[]) {
  const ids = [...new Set(rows.map((r) => r.invoiceId).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return;
  const paid = await db.creditCardInvoice.count({ where: { id: { in: ids }, status: "PAID" } });
  if (paid > 0) throw new AppError("INVOICE_PAID");
}

export async function createTransaction(
  ctx: ServiceContext,
  input: CreateTransactionInput,
  today: ISODate,
): Promise<Transaction> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const category = await validateReferences(tx, ctx, input);
    const recurring = Boolean(input.repeat) && input.type !== "TRANSFER";
    const nature = resolveNature(input.type, input.nature, category?.defaultNature, recurring);
    const fields = { ...ledgerFields(input, nature), ...(await cardFields(tx, ctx, input)) };

    if (recurring && input.repeat) {
      const recurrence = await createRecurrence(
        tx,
        ctx,
        templateOf(input, nature),
        input.repeat,
        input.creditCardId ? input.date : fromDbDate(fields.dueDate),
        today,
      );
      const first = await tx.transaction.findFirst({
        where: { recurrenceId: recurrence.id },
        orderBy: { recurrenceDate: "asc" },
      });
      if (!first)
        throw new AppError("VALIDATION", "A repetição escolhida não gera nenhuma ocorrência.");
      // A 1ª ocorrência recebe o que só vale para ela: observações e se já foi paga.
      const updated = await tx.transaction.update({
        where: { id: first.id },
        data: {
          notes: fields.notes,
          status: first.creditCardId ? first.status : fields.status,
          settledAt:
            !first.creditCardId && fields.status === "SETTLED"
              ? (fields.settledAt ?? first.dueDate)
              : null,
        },
      });
      await audit(tx, ctx, {
        action: "transaction.create",
        entityType: "Transaction",
        entityId: updated.id,
        after: updated,
      });
      return updated;
    }

    const created = await tx.transaction.create({
      data: { workspaceId: ctx.workspaceId, ...fields },
    });
    await audit(tx, ctx, {
      action: "transaction.create",
      entityType: "Transaction",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateTransaction(
  ctx: ServiceContext,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwned(tx, ctx, input.id);
    if (!EDITABLE_TYPES.has(before.type)) throw new AppError("TRANSACTION_LOCKED");
    if (await tx.commission.findUnique({ where: { transactionId: before.id } })) {
      throw new AppError("TRANSACTION_LOCKED", "Edite esta receita pela tela de Comissões.");
    }
    const inSeries = Boolean(before.recurrenceId || before.installmentPlanId);
    if (inSeries && before.type !== input.type) throw new AppError("TRANSACTION_TYPE_LOCKED");

    const category = await validateReferences(tx, ctx, input, before);
    const nature = resolveNature(
      input.type,
      input.nature,
      category?.defaultNature,
      Boolean(before.recurrenceId),
    );
    await assertNotInPaidInvoice(tx, [before]);
    const fields = {
      ...ledgerFields(input, nature),
      ...(await cardFields(tx, ctx, input, before)),
    };

    if (before.recurrenceId && input.scope !== "this") {
      const recurrence = await getOwnedRecurrence(tx, ctx, before.recurrenceId);
      const from =
        input.scope === "future" && before.recurrenceDate
          ? fromDbDate(before.recurrenceDate)
          : null;
      await applyTemplateToSeries(tx, ctx, recurrence, templateOf(input, nature), from);
    }

    const after = await tx.transaction.update({
      where: { id: before.id },
      data: {
        ...fields,
        isRecurrenceOverride: before.recurrenceId
          ? before.isRecurrenceOverride || input.scope === "this"
          : false,
      },
    });
    await audit(tx, ctx, {
      action: "transaction.update",
      entityType: "Transaction",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

/** Marca como pago/recebido. Lançamentos sem conta usam `accountId` (obrigatória nesse caso). */
export async function settleTransactions(
  ctx: ServiceContext,
  input: { ids: string[]; settledAt: ISODate; accountId: string | null },
): Promise<number> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({
      where: {
        id: { in: input.ids },
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        status: "PENDING",
      },
    });
    if (input.accountId) {
      const account = await accountRepository.findById(tx, ctx.workspaceId, input.accountId);
      if (!account) throw new AppError("NOT_FOUND", "Conta não encontrada.");
    }
    for (const row of rows) {
      if (!EDITABLE_TYPES.has(row.type)) throw new AppError("TRANSACTION_LOCKED");
      if (row.creditCardId) {
        throw new AppError("TRANSACTION_LOCKED", "Compras no cartão são pagas junto com a fatura.");
      }
      const accountId = row.accountId ?? (row.creditCardId ? null : input.accountId);
      if (!accountId && !row.creditCardId) throw new AppError("ACCOUNT_REQUIRED");
      await tx.transaction.update({
        where: { id: row.id },
        data: { status: "SETTLED", settledAt: toDbDate(input.settledAt), accountId },
      });
    }
    await audit(tx, ctx, {
      action: "transaction.settle",
      entityType: "Transaction",
      after: { ids: rows.map((r) => r.id), settledAt: input.settledAt },
    });
    return rows.length;
  });
}

export async function unsettleTransactions(ctx: ServiceContext, ids: string[]): Promise<number> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({
      where: { id: { in: ids }, workspaceId: ctx.workspaceId, deletedAt: null, status: "SETTLED" },
    });
    for (const row of rows) {
      if (!EDITABLE_TYPES.has(row.type) || row.creditCardId)
        throw new AppError("TRANSACTION_LOCKED");
    }
    await tx.transaction.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: "PENDING", settledAt: null },
    });
    await audit(tx, ctx, {
      action: "transaction.unsettle",
      entityType: "Transaction",
      after: { ids: rows.map((r) => r.id) },
    });
    return rows.length;
  });
}

export async function setCanceled(
  ctx: ServiceContext,
  ids: string[],
  canceled: boolean,
): Promise<number> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({
      where: { id: { in: ids }, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    await assertNotInPaidInvoice(tx, rows);
    for (const row of rows)
      if (!EDITABLE_TYPES.has(row.type)) throw new AppError("TRANSACTION_LOCKED");
    await tx.transaction.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: canceled ? { status: "CANCELED", settledAt: null } : { status: "PENDING" },
    });
    for (const inv of new Set(
      rows.map((r) => r.invoiceId).filter((x): x is string => Boolean(x)),
    )) {
      await refreshInvoiceStatus(tx, inv, todayISO());
    }
    await audit(tx, ctx, {
      action: canceled ? "transaction.cancel" : "transaction.reactivate",
      entityType: "Transaction",
      after: { ids: rows.map((r) => r.id) },
    });
    return rows.length;
  });
}

/**
 * Envia para a lixeira. Para ocorrências de série com escopo "future", a série termina antes
 * desta ocorrência (as pendentes intocadas seguintes são removidas).
 */
export async function deleteTransactions(
  ctx: ServiceContext,
  ids: string[],
  scope: "this" | "future",
): Promise<number> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({
      where: { id: { in: ids }, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    await assertNotInPaidInvoice(tx, rows);
    for (const row of rows)
      if (!EDITABLE_TYPES.has(row.type)) throw new AppError("TRANSACTION_LOCKED");
    if (
      (await tx.commission.count({ where: { transactionId: { in: rows.map((r) => r.id) } } })) > 0
    ) {
      throw new AppError("TRANSACTION_LOCKED", "Exclua comissões pela tela de Comissões.");
    }
    await tx.transaction.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { deletedAt: new Date() },
    });
    if (scope === "future") {
      for (const row of rows) {
        if (!row.recurrenceId || !row.recurrenceDate) continue;
        const recurrence = await tx.recurrence.findFirst({
          where: { id: row.recurrenceId, deletedAt: null },
        });
        if (recurrence)
          await endSeries(tx, ctx, recurrence, addDays(fromDbDate(row.recurrenceDate), -1));
      }
    }
    for (const inv of new Set(
      rows.map((r) => r.invoiceId).filter((x): x is string => Boolean(x)),
    )) {
      await refreshInvoiceStatus(tx, inv, todayISO());
    }
    await audit(tx, ctx, {
      action: "transaction.delete",
      entityType: "Transaction",
      after: { ids: rows.map((r) => r.id), scope },
    });
    return rows.length;
  });
}

export async function restoreTransactions(ctx: ServiceContext, ids: string[]): Promise<number> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const result = await tx.transaction.updateMany({
      where: {
        id: { in: ids },
        workspaceId: ctx.workspaceId,
        deletedAt: { not: null },
        type: { in: ["INCOME", "EXPENSE", "TRANSFER", "REFUND"] },
      },
      data: { deletedAt: null },
    });
    await audit(tx, ctx, {
      action: "transaction.restore",
      entityType: "Transaction",
      after: { ids },
    });
    return result.count;
  });
}

/** Exclusão definitiva (só de itens na lixeira), incluindo os arquivos anexados. */
export async function purgeTransactions(ctx: ServiceContext, ids: string[]): Promise<number> {
  assertCan(ctx, "write");
  const keys = await prisma.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({
      where: { id: { in: ids }, workspaceId: ctx.workspaceId, deletedAt: { not: null } },
      include: {
        attachments: { select: { storageKey: true } },
        refunds: { select: { id: true } },
        commission: { select: { id: true } },
      },
    });
    const purgeable = rows.filter((r) => r.refunds.length === 0 && !r.commission);
    const purgeIds = purgeable.map((r) => r.id);
    await tx.attachment.deleteMany({ where: { transactionId: { in: purgeIds } } });
    await tx.transaction.deleteMany({ where: { id: { in: purgeIds } } });
    await audit(tx, ctx, {
      action: "transaction.purge",
      entityType: "Transaction",
      after: { ids: purgeIds },
    });
    return purgeable.flatMap((r) => r.attachments.map((a) => a.storageKey));
  });
  for (const key of keys) await storage().remove(key);
  return keys.length;
}

/** Job diário: esvazia a lixeira de itens com mais de 30 dias. */
export async function purgeOldTrash(): Promise<number> {
  const limit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const old = await prisma.transaction.findMany({
    where: { deletedAt: { lt: limit }, refunds: { none: {} }, commission: null },
    select: { id: true, workspaceId: true, attachments: { select: { storageKey: true } } },
  });
  if (old.length === 0) return 0;
  await prisma.attachment.deleteMany({ where: { transactionId: { in: old.map((o) => o.id) } } });
  await prisma.transaction.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  for (const o of old) for (const a of o.attachments) await storage().remove(a.storageKey);
  return old.length;
}

/**
 * Ajuste de saldo: lança a diferença entre o saldo real (informado) e o calculado, marcada como
 * ajuste — afeta o saldo, mas fica fora dos relatórios de receitas e despesas.
 */
export async function adjustBalance(
  ctx: ServiceContext,
  input: { accountId: string; actualBalance: string; date: ISODate },
): Promise<Transaction> {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const account = await accountRepository.findById(tx, ctx.workspaceId, input.accountId);
    if (!account) throw new AppError("NOT_FOUND");
    const balances = await accountRepository.balances(tx, ctx.workspaceId, input.date);
    const current = balances.get(account.id) ?? toMoney(0);
    const diff = toMoney(input.actualBalance).minus(current);
    if (diff.isZero()) throw new AppError("NOTHING_TO_ADJUST");
    const created = await tx.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: diff.isPositive() ? "INCOME" : "EXPENSE",
        status: "SETTLED",
        description: "Ajuste de saldo",
        notes: `Saldo calculado: ${current.toFixed(2)} · saldo informado: ${toMoney(input.actualBalance).toFixed(2)}`,
        amount: diff.abs().toFixed(2),
        date: toDbDate(input.date),
        dueDate: toDbDate(input.date),
        settledAt: toDbDate(input.date),
        accountId: account.id,
        isBalanceAdjustment: true,
      },
    });
    await audit(tx, ctx, {
      action: "account.adjustBalance",
      entityType: "Account",
      entityId: account.id,
      after: { diff: diff.toFixed(2) },
    });
    return created;
  });
}
