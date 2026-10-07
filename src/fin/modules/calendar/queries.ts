import {
  addDays,
  fromDbDate,
  type ISODate,
  type MonthKey,
  monthRange,
  toDbDate,
  weekdayOf,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { displayStatus, type DisplayStatus } from "@fin/modules/transactions/domain/status";

export type EventKind =
  | "salary"
  | "commission"
  | "income"
  | "bill"
  | "installment"
  | "subscription"
  | "invoice"
  | "transfer";

export interface CalendarEvent {
  id: string;
  date: ISODate;
  kind: EventKind;
  title: string;
  amount: string;
  /** Entrada (+) ou saída (−) de dinheiro. */
  direction: "in" | "out" | "move";
  status: DisplayStatus;
  href: string;
}

/** Grade do mês: começa no domingo da 1ª semana e termina no sábado da última. */
export function calendarGrid(month: MonthKey): { start: ISODate; end: ISODate } {
  const { start, end } = monthRange(month);
  return { start: addDays(start, -weekdayOf(start)), end: addDays(end, 6 - weekdayOf(end)) };
}

export async function calendarEvents(
  ctx: ServiceContext,
  month: MonthKey,
  today: ISODate,
): Promise<CalendarEvent[]> {
  const { start, end } = calendarGrid(month);
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      status: { not: "CANCELED" },
      isBalanceAdjustment: false,
      creditCardId: null,
      type: { in: ["INCOME", "EXPENSE", "TRANSFER"] },
      dueDate: { gte: toDbDate(start), lte: toDbDate(end) },
    },
    include: {
      category: { select: { incomeClass: true } },
      commission: { select: { id: true } },
      recurrence: { select: { subscription: { select: { id: true } } } },
    },
    orderBy: [{ dueDate: "asc" }, { amount: "desc" }],
  });
  const events: CalendarEvent[] = rows.map((t) => {
    const date = fromDbDate(t.dueDate);
    let kind: EventKind;
    if (t.type === "TRANSFER") kind = "transfer";
    else if (t.type === "INCOME")
      kind = t.commission ? "commission" : t.category?.incomeClass === "BASE" ? "salary" : "income";
    else if (t.installmentPlanId) kind = "installment";
    else if (t.recurrence?.subscription) kind = "subscription";
    else kind = "bill";
    return {
      id: t.id,
      date,
      kind,
      title: t.description,
      amount: toMoneyString(t.amount),
      direction: t.type === "INCOME" ? "in" : t.type === "TRANSFER" ? "move" : "out",
      status: displayStatus(t.status, date, today),
      href: `/financeiro/lancamentos?mes=${date.slice(0, 7)}&q=${encodeURIComponent(t.description)}`,
    };
  });

  const invoices = await prisma.creditCardInvoice.findMany({
    where: { workspaceId: ctx.workspaceId, dueDate: { gte: toDbDate(start), lte: toDbDate(end) } },
    include: {
      creditCard: { select: { id: true, name: true } },
      transactions: {
        where: { deletedAt: null, status: { not: "CANCELED" } },
        select: { type: true, amount: true },
      },
    },
  });
  for (const inv of invoices) {
    const total = inv.transactions.reduce(
      (sum, t) =>
        t.type === "EXPENSE"
          ? sum.plus(toMoney(t.amount))
          : t.type === "REFUND"
            ? sum.minus(toMoney(t.amount))
            : sum,
      ZERO,
    );
    if (total.lessThanOrEqualTo(0)) continue;
    const date = fromDbDate(inv.dueDate);
    events.push({
      id: inv.id,
      date,
      kind: "invoice",
      title: `Fatura ${inv.creditCard.name}`,
      amount: toMoneyString(total),
      direction: "out",
      status: inv.status === "PAID" ? "SETTLED" : date < today ? "OVERDUE" : "PENDING",
      href: `/financeiro/cartoes/${inv.creditCard.id}/faturas/${fromDbDate(inv.referenceMonth).slice(0, 7)}`,
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
