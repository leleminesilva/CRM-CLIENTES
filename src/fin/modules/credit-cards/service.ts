import { Prisma } from "@prisma/client";
import type { CreditCard, CreditCardInvoice } from "@prisma/client";
import type { InvoiceStatus } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { formatMonth, fromDbDate, type ISODate, type MonthKey, toDbDate } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError, normalizeError } from "@fin/lib/errors";
import { toMoney, ZERO } from "@fin/lib/money";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { cycleForReferenceMonth, resolveInvoice } from "./domain/invoice-cycle";
import type { CreateCardInput, UpdateCardInput } from "./schemas";

export async function getOwnedCard(
  db: DbClient,
  ctx: ServiceContext,
  id: string,
): Promise<CreditCard> {
  const card = await db.creditCard.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!card) throw new AppError("NOT_FOUND");
  return card;
}

async function getOwnedInvoice(db: DbClient, ctx: ServiceContext, id: string) {
  const invoice = await db.creditCardInvoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { creditCard: true },
  });
  if (!invoice) throw new AppError("INVOICE_NOT_FOUND");
  return invoice;
}

function rethrowNameConflict(error: unknown): never {
  const normalized = normalizeError(error);
  if (normalized instanceof AppError && normalized.code === "CONFLICT")
    throw new AppError("CARD_NAME_TAKEN");
  throw normalized;
}

function cardData(input: CreateCardInput) {
  return {
    name: input.name,
    issuer: input.issuer,
    brand: input.brand,
    lastFour: input.lastFour,
    creditLimit: input.creditLimit,
    closingDay: input.closingDay,
    dueDay: input.dueDay,
    paymentAccountId: input.paymentAccountId,
    color: input.color,
  };
}

async function assertPaymentAccount(db: DbClient, ctx: ServiceContext, accountId: string | null) {
  if (!accountId) return;
  const account = await db.account.findFirst({
    where: { id: accountId, workspaceId: ctx.workspaceId },
  });
  if (!account) throw new AppError("NOT_FOUND", "Conta não encontrada.");
}

export async function createCard(ctx: ServiceContext, input: CreateCardInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    await assertPaymentAccount(tx, ctx, input.paymentAccountId);
    const sortOrder =
      ((
        await tx.creditCard.aggregate({
          where: { workspaceId: ctx.workspaceId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) + 1;
    const created = await tx.creditCard
      .create({ data: { workspaceId: ctx.workspaceId, ...cardData(input), sortOrder } })
      .catch(rethrowNameConflict);
    await audit(tx, ctx, {
      action: "card.create",
      entityType: "CreditCard",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

/** Mudar fechamento/vencimento só afeta faturas futuras: as existentes guardam as próprias datas. */
export async function updateCard(ctx: ServiceContext, input: UpdateCardInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwnedCard(tx, ctx, input.id);
    await assertPaymentAccount(tx, ctx, input.paymentAccountId);
    const after = await tx.creditCard
      .update({ where: { id: before.id }, data: cardData(input) })
      .catch(rethrowNameConflict);
    await audit(tx, ctx, {
      action: "card.update",
      entityType: "CreditCard",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

export async function setCardArchived(ctx: ServiceContext, id: string, archived: boolean) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    await getOwnedCard(tx, ctx, id);
    await tx.creditCard.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await audit(tx, ctx, {
      action: archived ? "card.archive" : "card.unarchive",
      entityType: "CreditCard",
      entityId: id,
    });
  });
}

export async function deleteCard(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const card = await getOwnedCard(tx, ctx, id);
    const refs =
      (await tx.transaction.count({ where: { creditCardId: id } })) +
      (await tx.creditCardInvoice.count({ where: { creditCardId: id } })) +
      (await tx.installmentPlan.count({ where: { creditCardId: id } })) +
      (await tx.recurrence.count({ where: { creditCardId: id } }));
    if (refs > 0) throw new AppError("CARD_HAS_HISTORY");
    await tx.creditCard.delete({ where: { id } });
    await audit(tx, ctx, {
      action: "card.delete",
      entityType: "CreditCard",
      entityId: id,
      before: card,
    });
  });
}

/** Fatura do mês de vencimento; cria se ainda não existe (datas gravadas a partir dos dias atuais do cartão). */
export async function ensureInvoice(
  db: DbClient,
  card: CreditCard,
  referenceMonth: MonthKey,
): Promise<CreditCardInvoice> {
  const existing = await db.creditCardInvoice.findUnique({
    where: {
      creditCardId_referenceMonth: {
        creditCardId: card.id,
        referenceMonth: toDbDate(`${referenceMonth}-01`),
      },
    },
  });
  if (existing) return existing;
  const cycle = cycleForReferenceMonth(referenceMonth, card.closingDay, card.dueDay);
  return db.creditCardInvoice.upsert({
    where: {
      creditCardId_referenceMonth: {
        creditCardId: card.id,
        referenceMonth: toDbDate(`${referenceMonth}-01`),
      },
    },
    update: {},
    create: {
      workspaceId: card.workspaceId,
      creditCardId: card.id,
      referenceMonth: toDbDate(`${referenceMonth}-01`),
      closingDate: toDbDate(cycle.closingDate),
      dueDate: toDbDate(cycle.dueDate),
    },
  });
}

/** Fatura em que uma compra cai. Se a fatura já está paga, a compra é recusada (reabra o pagamento). */
export async function invoiceForPurchase(
  db: DbClient,
  card: CreditCard,
  purchaseDate: ISODate,
): Promise<CreditCardInvoice> {
  const invoice = await ensureInvoice(
    db,
    card,
    resolveInvoice(purchaseDate, card.closingDay, card.dueDay).referenceMonth,
  );
  if (invoice.status === "PAID") throw new AppError("INVOICE_PAID");
  return invoice;
}

/** Total das compras (− estornos) e total pago por fatura. */
export async function invoiceMoney(
  db: DbClient,
  invoiceIds: string[],
): Promise<Map<string, { total: ReturnType<typeof toMoney>; paid: ReturnType<typeof toMoney> }>> {
  if (invoiceIds.length === 0) return new Map();
  const rows = await db.$queryRaw<
    { invoice_id: string; total: string | null; paid: string | null }[]
  >(Prisma.sql`
    SELECT invoice_id,
      SUM(CASE WHEN type = 'EXPENSE' AND status <> 'CANCELED' THEN amount WHEN type = 'REFUND' AND status <> 'CANCELED' THEN -amount END)::text AS total,
      SUM(CASE WHEN type = 'CARD_PAYMENT' AND status = 'SETTLED' THEN amount END)::text AS paid
    FROM fin_transactions
    WHERE invoice_id IN (${Prisma.join(invoiceIds.map((id) => Prisma.sql`${id}::uuid`))}) AND deleted_at IS NULL
    GROUP BY invoice_id`);
  return new Map(
    rows.map((r) => [r.invoice_id, { total: toMoney(r.total ?? 0), paid: toMoney(r.paid ?? 0) }]),
  );
}

/** Recalcula o status da fatura (aberta, fechada, paga em parte, paga) a partir dos itens e pagamentos. */
export async function refreshInvoiceStatus(
  db: DbClient,
  invoiceId: string,
  today: ISODate,
): Promise<InvoiceStatus> {
  const invoice = await db.creditCardInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const money = (await invoiceMoney(db, [invoiceId])).get(invoiceId) ?? { total: ZERO, paid: ZERO };
  let status: InvoiceStatus;
  if (money.total.greaterThan(0) && money.paid.greaterThanOrEqualTo(money.total)) status = "PAID";
  else if (money.paid.greaterThan(0)) status = "PARTIALLY_PAID";
  else status = fromDbDate(invoice.closingDate) <= today ? "CLOSED" : "OPEN";
  if (status !== invoice.status) {
    await db.creditCardInvoice.update({
      where: { id: invoiceId },
      data: { status, closedAt: status === "OPEN" ? null : (invoice.closedAt ?? new Date()) },
    });
  }
  return status;
}

export async function payInvoice(
  ctx: ServiceContext,
  input: { invoiceId: string; accountId: string; amount: string; date: ISODate },
  today: ISODate,
) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const invoice = await getOwnedInvoice(tx, ctx, input.invoiceId);
    await assertPaymentAccount(tx, ctx, input.accountId);
    const money = (await invoiceMoney(tx, [invoice.id])).get(invoice.id) ?? {
      total: ZERO,
      paid: ZERO,
    };
    if (money.total.lessThanOrEqualTo(0)) throw new AppError("INVOICE_EMPTY");
    const remaining = money.total.minus(money.paid);
    if (remaining.lessThanOrEqualTo(0)) throw new AppError("INVOICE_PAID");
    const amount = toMoney(input.amount);
    if (amount.greaterThan(remaining)) throw new AppError("PAYMENT_TOO_HIGH");

    const payment = await tx.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: "CARD_PAYMENT",
        status: "SETTLED",
        description: `Pagamento da fatura ${invoice.creditCard.name} (${formatMonth(invoice.referenceMonth.toISOString().slice(0, 7), "short")})`,
        amount: amount.toFixed(2),
        date: toDbDate(input.date),
        dueDate: invoice.dueDate,
        settledAt: toDbDate(input.date),
        accountId: input.accountId,
        creditCardId: invoice.creditCardId,
        invoiceId: invoice.id,
      },
    });
    // Pagou tudo: as compras da fatura passam a pagas na data do pagamento.
    if (amount.equals(remaining)) {
      await tx.transaction.updateMany({
        where: {
          invoiceId: invoice.id,
          status: "PENDING",
          type: { in: ["EXPENSE", "REFUND"] },
          deletedAt: null,
        },
        data: { status: "SETTLED", settledAt: toDbDate(input.date) },
      });
    }
    await refreshInvoiceStatus(tx, invoice.id, today);
    await audit(tx, ctx, {
      action: "invoice.pay",
      entityType: "CreditCardInvoice",
      entityId: invoice.id,
      after: { amount: amount.toFixed(2), accountId: input.accountId },
    });
    return payment;
  });
}

/** Desfaz os pagamentos da fatura: compras voltam a pendentes e o dinheiro volta para a conta. */
export async function undoInvoicePayments(ctx: ServiceContext, invoiceId: string, today: ISODate) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const invoice = await getOwnedInvoice(tx, ctx, invoiceId);
    // Pagamento é gerado pelo sistema: desfazer remove de vez (a auditoria guarda o histórico).
    const removed = await tx.transaction.deleteMany({
      where: { invoiceId: invoice.id, type: "CARD_PAYMENT" },
    });
    if (removed.count === 0)
      throw new AppError("NOT_FOUND", "Esta fatura não tem pagamentos para desfazer.");
    await tx.transaction.updateMany({
      where: {
        invoiceId: invoice.id,
        status: "SETTLED",
        type: { in: ["EXPENSE", "REFUND"] },
        deletedAt: null,
      },
      data: { status: "PENDING", settledAt: null },
    });
    await refreshInvoiceStatus(tx, invoice.id, today);
    await audit(tx, ctx, {
      action: "invoice.undoPayment",
      entityType: "CreditCardInvoice",
      entityId: invoice.id,
    });
  });
}

/**
 * Conciliação: guarda o valor cobrado pelo banco. Com `createAdjustment`, lança a diferença
 * (juros, IOF, compra esquecida) como despesa em "Encargos do cartão" — ou estorno, se o banco cobrou menos.
 */
export async function reconcileInvoice(
  ctx: ServiceContext,
  input: { invoiceId: string; statementAmount: string; createAdjustment: boolean },
  today: ISODate,
) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const invoice = await getOwnedInvoice(tx, ctx, input.invoiceId);
    if (invoice.status === "PAID" && input.createAdjustment) throw new AppError("INVOICE_PAID");
    const money = (await invoiceMoney(tx, [invoice.id])).get(invoice.id) ?? {
      total: ZERO,
      paid: ZERO,
    };
    const statement = toMoney(input.statementAmount);
    const diff = statement.minus(money.total);
    if (input.createAdjustment && !diff.isZero()) {
      const fees = await tx.category.findFirst({
        where: { workspaceId: ctx.workspaceId, systemKey: "card_fees" },
      });
      await tx.transaction.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: diff.isPositive() ? "EXPENSE" : "REFUND",
          status: "PENDING",
          description: "Ajuste de conciliação da fatura",
          notes: `Valor do banco ${statement.toFixed(2)} − soma das compras ${money.total.toFixed(2)}`,
          amount: diff.abs().toFixed(2),
          date: invoice.closingDate,
          dueDate: invoice.dueDate,
          creditCardId: invoice.creditCardId,
          invoiceId: invoice.id,
          categoryId: fees?.id ?? null,
          nature: diff.isPositive() ? "VARIABLE" : null,
        },
      });
    }
    await tx.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { statementAmount: statement.toFixed(2) },
    });
    await refreshInvoiceStatus(tx, invoice.id, today);
    await audit(tx, ctx, {
      action: "invoice.reconcile",
      entityType: "CreditCardInvoice",
      entityId: invoice.id,
      after: {
        statement: statement.toFixed(2),
        diff: diff.toFixed(2),
        adjusted: input.createAdjustment,
      },
    });
    return { difference: diff.toFixed(2) };
  });
}

/** Move uma compra para outra fatura do mesmo cartão (bancos têm exceções ao ciclo). */
export async function moveToInvoice(
  ctx: ServiceContext,
  input: { transactionId: string; referenceMonth: MonthKey },
  today: ISODate,
) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const item = await tx.transaction.findFirst({
      where: {
        id: input.transactionId,
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        type: { in: ["EXPENSE", "REFUND"] },
        creditCardId: { not: null },
      },
    });
    if (!item?.creditCardId || !item.invoiceId) throw new AppError("NOT_FOUND");
    const card = await getOwnedCard(tx, ctx, item.creditCardId);
    const from = await tx.creditCardInvoice.findUniqueOrThrow({ where: { id: item.invoiceId } });
    const target = await ensureInvoice(tx, card, input.referenceMonth);
    if (from.status === "PAID" || target.status === "PAID") throw new AppError("INVOICE_PAID");
    if (target.id === from.id) return;
    await tx.transaction.update({
      where: { id: item.id },
      data: { invoiceId: target.id, dueDate: target.dueDate },
    });
    await refreshInvoiceStatus(tx, from.id, today);
    await refreshInvoiceStatus(tx, target.id, today);
    await audit(tx, ctx, {
      action: "invoice.moveItem",
      entityType: "Transaction",
      entityId: item.id,
      before: { invoiceId: from.id },
      after: { invoiceId: target.id },
    });
  });
}

/** Job diário: marca como fechadas as faturas cujo fechamento já passou. */
export async function closeDueInvoices(today: ISODate): Promise<number> {
  const result = await prisma.creditCardInvoice.updateMany({
    where: { status: "OPEN", closingDate: { lte: toDbDate(today) } },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  return result.count;
}
