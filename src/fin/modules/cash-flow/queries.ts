import { addDays, fromDbDate, type ISODate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { accountRepository } from "@fin/modules/accounts/repository";
import { invoiceMoney } from "@fin/modules/credit-cards/service";
import { buildBuckets, type CashEvent, type Granularity, openingAt } from "./domain/buckets";

/**
 * Eventos que mexem no dinheiro disponível (contas líquidas) entre `from` e `to`:
 *  - liquidados: na data em que foram pagos/recebidos (pagamento de fatura sai na data do pagamento);
 *  - previstos: no vencimento (atrasados contam como "hoje");
 *  - faturas em aberto: o que falta pagar, no vencimento da fatura (as compras individuais não entram,
 *    para não contar duas vezes a parte já paga).
 * Transferências só contam quando cruzam a fronteira do "disponível" (aplicação ou resgate).
 */
export async function loadCashEvents(
  ctx: ServiceContext,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): Promise<{ events: CashEvent[]; liquidAccountIds: string[] }> {
  const accounts = await prisma.account.findMany({
    where: { workspaceId: ctx.workspaceId, archivedAt: null },
    select: { id: true, isLiquid: true },
  });
  const liquid = new Set(accounts.filter((a) => a.isLiquid).map((a) => a.id));
  const events: CashEvent[] = [];

  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      status: { not: "CANCELED" },
      OR: [
        { status: "SETTLED", settledAt: { gte: toDbDate(from), lte: toDbDate(to) } },
        { status: "PENDING", dueDate: { lte: toDbDate(to) } },
      ],
    },
    select: {
      type: true,
      status: true,
      amount: true,
      dueDate: true,
      settledAt: true,
      accountId: true,
      transferAccountId: true,
      creditCardId: true,
      isBalanceAdjustment: true,
      description: true,
    },
  });
  for (const r of rows) {
    const realized = r.status === "SETTLED";
    const rawDate = realized ? fromDbDate(r.settledAt!) : fromDbDate(r.dueDate);
    // Previsto em atraso ainda vai acontecer: conta a partir de hoje.
    const date = !realized && rawDate < today ? today : rawDate;
    if (date < from || date > to) continue;
    const amount = toMoney(r.amount);
    const inLiquid = (id: string | null) => (id === null ? true : liquid.has(id));

    if (r.type === "TRANSFER") {
      const fromLiquid = r.accountId !== null && liquid.has(r.accountId);
      const toLiquid = r.transferAccountId !== null && liquid.has(r.transferAccountId);
      if (fromLiquid && !toLiquid)
        events.push({
          date,
          amount: amount.negated(),
          kind: "application",
          realized,
          description: r.description,
        });
      else if (!fromLiquid && toLiquid)
        events.push({ date, amount, kind: "application", realized, description: r.description });
      continue;
    }
    if (r.creditCardId && r.type !== "CARD_PAYMENT") continue; // vira a fatura
    if (!inLiquid(r.accountId)) continue; // conta fora do disponível (investimento, vale)
    if (r.isBalanceAdjustment) {
      events.push({
        date,
        amount: r.type === "INCOME" ? amount : amount.negated(),
        kind: "adjustment",
        realized,
        description: r.description,
      });
    } else if (r.type === "INCOME" || r.type === "REFUND") {
      events.push({ date, amount, kind: "income", realized, description: r.description });
    } else {
      events.push({
        date,
        amount: amount.negated(),
        kind: "expense",
        realized,
        description: r.description,
      });
    }
  }

  // Faturas em aberto: saldo a pagar no vencimento.
  const invoices = await prisma.creditCardInvoice.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: { not: "PAID" },
      dueDate: { lte: toDbDate(to) },
    },
    select: { id: true, dueDate: true, creditCard: { select: { name: true } } },
  });
  const money = await invoiceMoney(
    prisma,
    invoices.map((i) => i.id),
  );
  for (const inv of invoices) {
    const m = money.get(inv.id);
    const remaining = m ? m.total.minus(m.paid) : ZERO;
    if (remaining.lessThanOrEqualTo(0)) continue;
    const due = fromDbDate(inv.dueDate);
    const date = due < today ? today : due;
    if (date >= from && date <= to)
      events.push({
        date,
        amount: remaining.negated(),
        kind: "expense",
        realized: false,
        description: `Fatura ${inv.creditCard.name}`,
      });
  }
  return { events, liquidAccountIds: [...liquid] };
}

async function liquidBalanceAsOf(ctx: ServiceContext, asOf: ISODate, liquidIds: string[]) {
  const balances = await accountRepository.balances(prisma, ctx.workspaceId, asOf);
  return liquidIds.reduce((sum, id) => sum.plus(balances.get(id) ?? ZERO), ZERO);
}

export interface CashFlowParams {
  from: ISODate;
  to: ISODate;
  granularity: Granularity;
}

export async function cashFlow(ctx: ServiceContext, params: CashFlowParams, today: ISODate) {
  // O saldo-base é o de ontem (ou de antes do período); eventos entre a base e `from` completam a abertura.
  const start = params.from < today ? params.from : today;
  const baseDate = addDays(start, -1);
  const { events, liquidAccountIds } = await loadCashEvents(ctx, start, params.to, today);
  const base = await liquidBalanceAsOf(ctx, baseDate, liquidAccountIds);
  const opening = openingAt({ date: baseDate, balance: base }, events, params.from);
  const buckets = buildBuckets(events, { ...params, opening, today });
  return { buckets, events, opening };
}

export async function currentLiquidBalance(ctx: ServiceContext, today: ISODate) {
  const accounts = await prisma.account.findMany({
    where: { workspaceId: ctx.workspaceId, archivedAt: null, isLiquid: true },
    select: { id: true },
  });
  return liquidBalanceAsOf(
    ctx,
    today,
    accounts.map((a) => a.id),
  );
}
