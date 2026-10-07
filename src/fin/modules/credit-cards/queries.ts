import { Prisma } from "@prisma/client";
import {
  addMonthsToKey,
  fromDbDate,
  type ISODate,
  type MonthKey,
  monthKeyOf,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { toTransactionDTO } from "@fin/modules/transactions/queries";
import { currentInvoice, cycleForReferenceMonth } from "./domain/invoice-cycle";
import { invoiceMoney } from "./service";
import type { CardDTO, InvoiceSummaryDTO } from "./types";

type CardRow = Awaited<ReturnType<typeof prisma.creditCard.findMany>>[number];

/** Limite usado: tudo o que ainda não foi pago nas faturas, incluindo parcelas futuras (mas não assinaturas ainda não cobradas). */
async function usedLimits(
  workspaceId: string,
  today: ISODate,
): Promise<Map<string, ReturnType<typeof toMoney>>> {
  const rows = await prisma.$queryRaw<{ credit_card_id: string; used: string }[]>(Prisma.sql`
    SELECT i.credit_card_id, SUM(GREATEST(COALESCE(t.total, 0) - COALESCE(t.paid, 0), 0))::text AS used
    FROM fin_credit_card_invoices i
    JOIN LATERAL (
      SELECT
        SUM(CASE WHEN type = 'EXPENSE' AND status <> 'CANCELED' THEN amount WHEN type = 'REFUND' AND status <> 'CANCELED' THEN -amount END) AS total,
        SUM(CASE WHEN type = 'CARD_PAYMENT' AND status = 'SETTLED' THEN amount END) AS paid
      FROM fin_transactions
      WHERE invoice_id = i.id AND deleted_at IS NULL
        -- Cobranças recorrentes futuras (assinaturas) só consomem limite quando acontecem; parcelas futuras sempre.
        AND NOT (recurrence_id IS NOT NULL AND date > ${toDbDate(today)})
    ) t ON true
    WHERE i.workspace_id = ${workspaceId}::uuid
    GROUP BY i.credit_card_id`);
  return new Map(rows.map((r) => [r.credit_card_id, toMoney(r.used)]));
}

async function summarize(
  card: CardRow,
  referenceMonth: MonthKey,
  invoices: Awaited<ReturnType<typeof prisma.creditCardInvoice.findMany>>,
  money: Awaited<ReturnType<typeof invoiceMoney>>,
  today: ISODate,
): Promise<InvoiceSummaryDTO> {
  const invoice = invoices.find(
    (i) =>
      i.creditCardId === card.id && fromDbDate(i.referenceMonth).slice(0, 7) === referenceMonth,
  );
  const cycle = cycleForReferenceMonth(referenceMonth, card.closingDay, card.dueDay);
  const m = (invoice ? money.get(invoice.id) : null) ?? { total: ZERO, paid: ZERO };
  const closingDate = invoice ? fromDbDate(invoice.closingDate) : cycle.closingDate;
  const status = invoice ? invoice.status : "OPEN";
  return {
    id: invoice?.id ?? null,
    referenceMonth,
    closingDate,
    dueDate: invoice ? fromDbDate(invoice.dueDate) : cycle.dueDate,
    // Fechamento passado vale mesmo antes do job diário rodar.
    status: status === "OPEN" && closingDate <= today ? "CLOSED" : status,
    total: toMoneyString(m.total),
    paid: toMoneyString(m.paid),
    remaining: toMoneyString(m.total.minus(m.paid)),
    statementAmount: invoice?.statementAmount ? toMoneyString(invoice.statementAmount) : null,
    itemCount: 0,
  };
}

export async function listCards(
  ctx: ServiceContext,
  today: ISODate,
  opts: { includeArchived?: boolean } = {},
): Promise<CardDTO[]> {
  const cards = await prisma.creditCard.findMany({
    where: { workspaceId: ctx.workspaceId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (cards.length === 0) return [];
  const [used, invoices] = await Promise.all([
    usedLimits(ctx.workspaceId, today),
    prisma.creditCardInvoice.findMany({
      where: { workspaceId: ctx.workspaceId, creditCardId: { in: cards.map((c) => c.id) } },
    }),
  ]);
  const money = await invoiceMoney(
    prisma,
    invoices.map((i) => i.id),
  );
  const result: CardDTO[] = [];
  for (const c of cards) {
    const current = currentInvoice(today, c.closingDay, c.dueDay).referenceMonth;
    const usedAmount = used.get(c.id) ?? ZERO;
    result.push({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      brand: c.brand,
      lastFour: c.lastFour,
      color: c.color,
      creditLimit: toMoneyString(c.creditLimit),
      closingDay: c.closingDay,
      dueDay: c.dueDay,
      paymentAccountId: c.paymentAccountId,
      archived: c.archivedAt !== null,
      used: toMoneyString(usedAmount),
      available: toMoneyString(toMoney(c.creditLimit).minus(usedAmount)),
      currentInvoice: await summarize(c, current, invoices, money, today),
      nextInvoice: await summarize(c, addMonthsToKey(current, 1), invoices, money, today),
    });
  }
  return result;
}

export async function getCard(
  ctx: ServiceContext,
  id: string,
  today: ISODate,
): Promise<CardDTO | null> {
  return (await listCards(ctx, today, { includeArchived: true })).find((c) => c.id === id) ?? null;
}

/** Fatura de um mês de vencimento, com as compras. Se ainda não existe, volta vazia com as datas do ciclo. */
export async function getInvoiceDetail(
  ctx: ServiceContext,
  cardId: string,
  referenceMonth: MonthKey,
  today: ISODate,
) {
  const card = await prisma.creditCard.findFirst({
    where: { id: cardId, workspaceId: ctx.workspaceId },
  });
  if (!card) return null;
  const invoice = await prisma.creditCardInvoice.findUnique({
    where: {
      creditCardId_referenceMonth: {
        creditCardId: card.id,
        referenceMonth: toDbDate(`${referenceMonth}-01`),
      },
    },
  });
  const [summary] = await Promise.all([
    summarize(
      card,
      referenceMonth,
      invoice ? [invoice] : [],
      await invoiceMoney(prisma, invoice ? [invoice.id] : []),
      today,
    ),
  ]);
  const items = invoice
    ? await prisma.transaction.findMany({
        where: { invoiceId: invoice.id, deletedAt: null, type: { in: ["EXPENSE", "REFUND"] } },
        include: {
          account: { select: { id: true, name: true, color: true } },
          transferAccount: { select: { id: true, name: true, color: true } },
          category: {
            select: {
              id: true,
              name: true,
              icon: true,
              color: true,
              parent: { select: { name: true } },
            },
          },
          creditCard: { select: { id: true, name: true } },
          installmentPlan: { select: { installmentCount: true } },
          _count: { select: { attachments: true } },
          commission: { select: { id: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      })
    : [];
  const payments = invoice
    ? await prisma.transaction.findMany({
        where: { invoiceId: invoice.id, deletedAt: null, type: "CARD_PAYMENT" },
        include: { account: { select: { name: true } } },
        orderBy: { settledAt: "asc" },
      })
    : [];
  const itemDtos = items.map((r) => toTransactionDTO(r, today));
  return {
    card: {
      id: card.id,
      name: card.name,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      paymentAccountId: card.paymentAccountId,
      color: card.color,
    },
    invoice: { ...summary, itemCount: itemDtos.length },
    items: itemDtos,
    payments: payments.map((p) => ({
      id: p.id,
      amount: toMoneyString(p.amount),
      date: fromDbDate(p.settledAt ?? p.date),
      accountName: p.account?.name ?? "—",
    })),
    previousMonth: addMonthsToKey(referenceMonth, -1),
    nextMonth: addMonthsToKey(referenceMonth, 1),
  };
}

/** Faturas existentes do cartão (mais recentes primeiro), com totais. */
export async function listCardInvoices(
  ctx: ServiceContext,
  cardId: string,
  today: ISODate,
): Promise<InvoiceSummaryDTO[]> {
  const card = await prisma.creditCard.findFirst({
    where: { id: cardId, workspaceId: ctx.workspaceId },
  });
  if (!card) return [];
  const invoices = await prisma.creditCardInvoice.findMany({
    where: { creditCardId: card.id },
    orderBy: { referenceMonth: "desc" },
    take: 24,
  });
  const money = await invoiceMoney(
    prisma,
    invoices.map((i) => i.id),
  );
  const out: InvoiceSummaryDTO[] = [];
  for (const i of invoices)
    out.push(await summarize(card, fromDbDate(i.referenceMonth).slice(0, 7), [i], money, today));
  return out;
}

/** Compras mais recentes no cartão (qualquer fatura). */
export async function recentCardPurchases(
  ctx: ServiceContext,
  cardId: string,
  today: ISODate,
  limit = 8,
) {
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      creditCardId: cardId,
      deletedAt: null,
      type: { in: ["EXPENSE", "REFUND"] },
      date: { lte: toDbDate(today) },
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      transferAccount: { select: { id: true, name: true, color: true } },
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          parent: { select: { name: true } },
        },
      },
      creditCard: { select: { id: true, name: true } },
      installmentPlan: { select: { installmentCount: true } },
      _count: { select: { attachments: true } },
      commission: { select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => toTransactionDTO(r, today));
}

export { monthKeyOf };
