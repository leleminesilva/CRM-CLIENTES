import { Prisma } from "@prisma/client";
import {
  addDays,
  addMonthsToKey,
  fromDbDate,
  type ISODate,
  type MonthKey,
  monthKeyOf,
  monthRange,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";

export interface UpcomingItem {
  /** id do lançamento ou da fatura. */
  id: string;
  kind: "bill" | "invoice";
  description: string;
  dueDate: ISODate;
  amount: string;
  href: string;
  category: { icon: string; color: string } | null;
  overdue: boolean;
}

/** Contas a pagar nos próximos dias (e as vencidas). Compras no cartão aparecem como a fatura. */
export async function upcomingPayments(
  ctx: ServiceContext,
  today: ISODate,
  days = 30,
): Promise<UpcomingItem[]> {
  const until = toDbDate(addDays(today, days));
  const bills = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      status: "PENDING",
      type: "EXPENSE",
      creditCardId: null,
      dueDate: { lte: until },
    },
    include: { category: { select: { icon: true, color: true } } },
    orderBy: { dueDate: "asc" },
    take: 200,
  });
  const invoices = await prisma.$queryRaw<
    {
      id: string;
      card_id: string;
      card_name: string;
      reference_month: Date;
      due_date: Date;
      remaining: string;
    }[]
  >(Prisma.sql`
    SELECT i.id, c.id AS card_id, c.name AS card_name, i.reference_month, i.due_date,
      (COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' AND t.status <> 'CANCELED' THEN t.amount WHEN t.type = 'REFUND' AND t.status <> 'CANCELED' THEN -t.amount END), 0)
       - COALESCE(SUM(CASE WHEN t.type = 'CARD_PAYMENT' AND t.status = 'SETTLED' THEN t.amount END), 0))::text AS remaining
    FROM fin_credit_card_invoices i
    JOIN fin_credit_cards c ON c.id = i.credit_card_id
    LEFT JOIN fin_transactions t ON t.invoice_id = i.id AND t.deleted_at IS NULL
    WHERE i.workspace_id = ${ctx.workspaceId}::uuid AND i.status <> 'PAID' AND i.due_date <= ${until}
    GROUP BY i.id, c.id, c.name`);
  const items: UpcomingItem[] = [
    ...bills.map((b) => ({
      id: b.id,
      kind: "bill" as const,
      description: b.description,
      dueDate: fromDbDate(b.dueDate),
      amount: toMoneyString(b.amount),
      href: `/financeiro/lancamentos?mes=${monthKeyOf(fromDbDate(b.dueDate))}&q=${encodeURIComponent(b.description)}`,
      category: b.category,
      overdue: fromDbDate(b.dueDate) < today,
    })),
    ...invoices
      .filter((i) => toMoney(i.remaining).greaterThan(0))
      .map((i) => ({
        id: i.id,
        kind: "invoice" as const,
        description: `Fatura ${i.card_name}`,
        dueDate: fromDbDate(i.due_date),
        amount: toMoneyString(i.remaining),
        href: `/financeiro/cartoes/${i.card_id}/faturas/${fromDbDate(i.reference_month).slice(0, 7)}`,
        category: null,
        overdue: fromDbDate(i.due_date) < today,
      })),
  ];
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface MonthPoint {
  month: MonthKey;
  income: string;
  expense: string;
  result: string;
}

/** Receitas × despesas por mês (regra R0), sem ajustes, transferências e pagamentos de fatura. */
export async function monthlySeries(
  ctx: ServiceContext,
  endMonth: MonthKey,
  months = 12,
): Promise<MonthPoint[]> {
  const start = addMonthsToKey(endMonth, -(months - 1));
  const rows = await prisma.$queryRaw<
    { month: string; income: string | null; expense: string | null }[]
  >(Prisma.sql`
    SELECT to_char(due_date, 'YYYY-MM') AS month,
      SUM(CASE WHEN type = 'INCOME' THEN amount END)::text AS income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount WHEN type = 'REFUND' THEN -amount END)::text AS expense
    FROM fin_transactions
    WHERE workspace_id = ${ctx.workspaceId}::uuid AND deleted_at IS NULL AND status <> 'CANCELED' AND is_balance_adjustment = false
      AND due_date BETWEEN ${toDbDate(monthRange(start).start)} AND ${toDbDate(monthRange(endMonth).end)}
    GROUP BY 1`);
  return Array.from({ length: months }, (_, i) => {
    const month = addMonthsToKey(start, i);
    const r = rows.find((x) => x.month === month);
    const income = toMoney(r?.income ?? 0);
    const expense = toMoney(r?.expense ?? 0);
    return {
      month,
      income: toMoneyString(income),
      expense: toMoneyString(expense),
      result: toMoneyString(income.minus(expense)),
    };
  });
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: string;
  share: string;
}

/** Despesas do mês por categoria de 1º nível (subcategorias somadas no grupo), estornos abatidos. */
export async function spendingByCategory(
  ctx: ServiceContext,
  month: MonthKey,
): Promise<CategorySpend[]> {
  const { start, end } = monthRange(month);
  const rows = await prisma.$queryRaw<
    { id: string; name: string; icon: string; color: string; amount: string }[]
  >(Prisma.sql`
    SELECT g.id, g.name, g.icon, g.color,
      SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE -t.amount END)::text AS amount
    FROM fin_transactions t
    JOIN fin_categories c ON c.id = t.category_id
    JOIN fin_categories g ON g.id = COALESCE(c.parent_id, c.id)
    WHERE t.workspace_id = ${ctx.workspaceId}::uuid AND t.deleted_at IS NULL AND t.status <> 'CANCELED'
      AND t.type IN ('EXPENSE', 'REFUND') AND t.is_balance_adjustment = false
      AND t.due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}
    GROUP BY g.id, g.name, g.icon, g.color
    HAVING SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE -t.amount END) > 0
    ORDER BY SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE -t.amount END) DESC`);
  const total = rows.reduce((s, r) => s.plus(toMoney(r.amount)), ZERO);
  return rows.map((r) => ({
    categoryId: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    amount: toMoneyString(r.amount),
    share: total.isZero() ? "0" : toMoney(r.amount).dividedBy(total).toFixed(4),
  }));
}
