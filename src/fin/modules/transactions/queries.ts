import { Prisma } from "@prisma/client";
import type { IncomeClass, PaymentMethod, TransactionType } from "@prisma/client";
import {
  addDays,
  addMonthsToKey,
  fromDbDate,
  type ISODate,
  monthRange,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { accountRepository } from "@fin/modules/accounts/repository";
import { listAccountOptions } from "@fin/modules/accounts/queries";
import { getCategoryTree } from "@fin/modules/categories/queries";
import type { FormOptions } from "./form-options";
import { displayStatus } from "./domain/status";
import type { MonthTotals, TransactionDTO, TransactionFilters } from "./types";

const EDITABLE = new Set<TransactionType>(["INCOME", "EXPENSE", "TRANSFER", "REFUND"]);

const include = {
  account: { select: { id: true, name: true, color: true } },
  transferAccount: { select: { id: true, name: true, color: true } },
  category: {
    select: { id: true, name: true, icon: true, color: true, parent: { select: { name: true } } },
  },
  creditCard: { select: { id: true, name: true } },
  installmentPlan: { select: { installmentCount: true } },
  _count: { select: { attachments: true } },
  commission: { select: { id: true } },
} satisfies Prisma.TransactionInclude;

type Row = Prisma.TransactionGetPayload<{ include: typeof include }>;

export function toTransactionDTO(r: Row, today: ISODate): TransactionDTO {
  const dueDate = fromDbDate(r.dueDate);
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    displayStatus: displayStatus(r.status, dueDate, today),
    description: r.description,
    notes: r.notes,
    amount: toMoneyString(r.amount),
    date: fromDbDate(r.date),
    dueDate,
    settledAt: r.settledAt ? fromDbDate(r.settledAt) : null,
    account: r.account,
    transferAccount: r.transferAccount,
    category: r.category
      ? {
          id: r.category.id,
          name: r.category.name,
          icon: r.category.icon,
          color: r.category.color,
          parentName: r.category.parent?.name ?? null,
        }
      : null,
    nature: r.nature,
    paymentMethod: r.paymentMethod,
    recurrenceId: r.recurrenceId,
    isRecurrenceOverride: r.isRecurrenceOverride,
    installment:
      r.installmentNumber && r.installmentPlan
        ? { number: r.installmentNumber, count: r.installmentPlan.installmentCount }
        : null,
    creditCard: r.creditCard,
    isBalanceAdjustment: r.isBalanceAdjustment,
    attachmentCount: r._count.attachments,
    editable: EDITABLE.has(r.type),
    commissionId: r.commission?.id ?? null,
  };
}

function statusWhere(
  status: TransactionFilters["status"],
  today: ISODate,
): Prisma.TransactionWhereInput {
  switch (status) {
    case "SETTLED":
      return { status: "SETTLED" };
    case "CANCELED":
      return { status: "CANCELED" };
    case "PENDING":
      return { status: "PENDING", dueDate: { gte: toDbDate(today) } };
    case "OVERDUE":
      return { status: "PENDING", dueDate: { lt: toDbDate(today) } };
    default:
      return {};
  }
}

function typeWhere(type: TransactionFilters["type"]): Prisma.TransactionWhereInput {
  if (type === "INCOME") return { type: "INCOME" };
  if (type === "EXPENSE") return { type: { in: ["EXPENSE", "REFUND"] } };
  if (type === "TRANSFER") return { type: { in: ["TRANSFER", "CARD_PAYMENT"] } };
  return {};
}

/** Lançamentos do mês (regra R0: pelo vencimento), com filtros. */
export async function listTransactions(
  ctx: ServiceContext,
  filters: TransactionFilters,
  today: ISODate,
): Promise<TransactionDTO[]> {
  const { start, end } = monthRange(filters.month);
  const categoryIds = filters.categoryId
    ? [
        filters.categoryId,
        ...(
          await prisma.category.findMany({
            where: { parentId: filters.categoryId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        ).map((c) => c.id),
      ]
    : null;
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      dueDate: { gte: toDbDate(start), lte: toDbDate(end) },
      ...typeWhere(filters.type),
      ...statusWhere(filters.status, today),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(filters.nature ? { nature: filters.nature, type: "EXPENSE" as const } : {}),
      ...(filters.accountId
        ? { OR: [{ accountId: filters.accountId }, { transferAccountId: filters.accountId }] }
        : {}),
      ...(filters.q ? { description: { contains: filters.q, mode: "insensitive" as const } } : {}),
    },
    include,
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });
  return rows.map((r) => toTransactionDTO(r, today));
}

export async function getTransaction(
  ctx: ServiceContext,
  id: string,
  today: ISODate,
): Promise<TransactionDTO | null> {
  const row = await prisma.transaction.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include,
  });
  return row ? toTransactionDTO(row, today) : null;
}

interface TotalsRow {
  income_total: string | null;
  income_settled: string | null;
  income_overdue: string | null;
  expense_total: string | null;
  expense_settled: string | null;
  expense_overdue: string | null;
}

/**
 * Totais do mês pela regra de ouro (R0): vencimento no mês, sem cancelados, sem ajustes de saldo,
 * sem transferências e pagamentos de fatura. Estornos abatem as despesas.
 */
export async function monthTotals(
  ctx: ServiceContext,
  month: string,
  today: ISODate,
): Promise<MonthTotals> {
  const { start, end } = monthRange(month);
  const [row] = await prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
    SELECT
      SUM(CASE WHEN type = 'INCOME' THEN amount END)::text AS income_total,
      SUM(CASE WHEN type = 'INCOME' AND status = 'SETTLED' THEN amount END)::text AS income_settled,
      SUM(CASE WHEN type = 'INCOME' AND status = 'PENDING' AND due_date < ${toDbDate(today)} THEN amount END)::text AS income_overdue,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount WHEN type = 'REFUND' THEN -amount END)::text AS expense_total,
      SUM(CASE WHEN type = 'EXPENSE' AND status = 'SETTLED' THEN amount WHEN type = 'REFUND' AND status = 'SETTLED' THEN -amount END)::text AS expense_settled,
      SUM(CASE WHEN type = 'EXPENSE' AND status = 'PENDING' AND due_date < ${toDbDate(today)} THEN amount END)::text AS expense_overdue
    FROM fin_transactions
    WHERE workspace_id = ${ctx.workspaceId}::uuid
      AND deleted_at IS NULL
      AND status <> 'CANCELED'
      AND is_balance_adjustment = false
      AND due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}`);
  const m = (v: string | null | undefined) => toMoney(v ?? 0);
  const incomeTotal = m(row?.income_total);
  const incomeSettled = m(row?.income_settled);
  const expenseTotal = m(row?.expense_total);
  const expenseSettled = m(row?.expense_settled);
  return {
    income: {
      total: toMoneyString(incomeTotal),
      settled: toMoneyString(incomeSettled),
      pending: toMoneyString(incomeTotal.minus(incomeSettled)),
      overdue: toMoneyString(m(row?.income_overdue)),
    },
    expense: {
      total: toMoneyString(expenseTotal),
      settled: toMoneyString(expenseSettled),
      pending: toMoneyString(expenseTotal.minus(expenseSettled)),
      overdue: toMoneyString(m(row?.expense_overdue)),
    },
    result: toMoneyString(incomeTotal.minus(expenseTotal)),
    settledResult: toMoneyString(incomeSettled.minus(expenseSettled)),
  };
}

export interface IncomeClassTotals {
  incomeClass: IncomeClass;
  total: string;
  settled: string;
}

/** Receitas do mês por classe (Base · Comissões · Extra · Outros). */
export async function incomeByClass(
  ctx: ServiceContext,
  month: string,
): Promise<IncomeClassTotals[]> {
  const { start, end } = monthRange(month);
  const rows = await prisma.$queryRaw<
    { income_class: IncomeClass | null; total: string; settled: string | null }[]
  >(Prisma.sql`
    SELECT c.income_class, SUM(t.amount)::text AS total,
           SUM(CASE WHEN t.status = 'SETTLED' THEN t.amount END)::text AS settled
    FROM fin_transactions t
    LEFT JOIN fin_categories c ON c.id = t.category_id
    WHERE t.workspace_id = ${ctx.workspaceId}::uuid AND t.deleted_at IS NULL AND t.type = 'INCOME'
      AND t.status <> 'CANCELED' AND t.is_balance_adjustment = false
      AND t.due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}
    GROUP BY c.income_class`);
  const classes: IncomeClass[] = ["BASE", "COMMISSION", "EXTRA", "OTHER"];
  return classes.map((incomeClass) => {
    const matching = rows.filter((r) => (r.income_class ?? "OTHER") === incomeClass);
    return {
      incomeClass,
      total: toMoneyString(matching.reduce((s, r) => s.plus(toMoney(r.total)), ZERO)),
      settled: toMoneyString(matching.reduce((s, r) => s.plus(toMoney(r.settled ?? 0)), ZERO)),
    };
  });
}

export interface DescriptionSuggestion {
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  categoryId: string | null;
  accountId: string | null;
  paymentMethod: PaymentMethod | null;
}

/** Descrições já usadas (sem acento, por trecho), com a última categoria/conta/valor de cada uma. */
export async function suggestDescriptions(
  ctx: ServiceContext,
  q: string,
): Promise<DescriptionSuggestion[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.$queryRaw<
    {
      description: string;
      type: "INCOME" | "EXPENSE";
      amount: string;
      category_id: string | null;
      account_id: string | null;
      payment_method: PaymentMethod | null;
      last: Date;
    }[]
  >(Prisma.sql`
    SELECT * FROM (
      SELECT DISTINCT ON (lower(description)) description, type, amount::text AS amount, category_id, account_id,
             payment_method, date AS last
      FROM fin_transactions
      WHERE workspace_id = ${ctx.workspaceId}::uuid AND deleted_at IS NULL AND type IN ('INCOME', 'EXPENSE')
        AND is_balance_adjustment = false
        AND fin_immutable_unaccent(lower(description)) LIKE '%' || fin_immutable_unaccent(lower(${term})) || '%'
      ORDER BY lower(description), date DESC
    ) s ORDER BY last DESC LIMIT 8`);
  return rows.map((r) => ({
    description: r.description,
    type: r.type,
    amount: toMoneyString(r.amount),
    categoryId: r.category_id,
    accountId: r.account_id,
    paymentMethod: r.payment_method,
  }));
}

export async function listTrash(ctx: ServiceContext, today: ISODate) {
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: { not: null },
      type: { in: ["INCOME", "EXPENSE", "TRANSFER", "REFUND"] },
    },
    include,
    orderBy: { deletedAt: "desc" },
    take: 500,
  });
  return rows.map((r) => ({
    ...toTransactionDTO(r, today),
    deletedAt: r.deletedAt?.toISOString() ?? null,
  }));
}

export interface StatementLine {
  transaction: TransactionDTO;
  /** Efeito no saldo desta conta (com sinal). */
  delta: string;
  balanceAfter: string;
}

/** Extrato da conta no mês: saldo de abertura, movimentos liquidados e saldo corrido. */
export async function accountStatement(
  ctx: ServiceContext,
  accountId: string,
  month: string,
  today: ISODate,
) {
  const { start, end } = monthRange(month);
  const opening =
    (await accountRepository.balances(prisma, ctx.workspaceId, addDays(start, -1))).get(
      accountId,
    ) ?? ZERO;
  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      status: "SETTLED",
      settledAt: { gte: toDbDate(start), lte: toDbDate(end) },
      OR: [{ accountId }, { transferAccountId: accountId }],
    },
    include,
    orderBy: [{ settledAt: "asc" }, { createdAt: "asc" }],
  });
  const account = await prisma.account.findFirst({
    where: { id: accountId, workspaceId: ctx.workspaceId },
  });
  const initialDate = account ? fromDbDate(account.initialBalanceDate) : start;
  let balance = opening;
  const lines: StatementLine[] = [];
  for (const r of rows) {
    if (r.settledAt && fromDbDate(r.settledAt) < initialDate) continue; // já incluído no saldo inicial
    const amount = toMoney(r.amount);
    let delta = ZERO;
    if (r.type === "INCOME" || r.type === "REFUND") delta = amount;
    else if (r.type === "EXPENSE" || r.type === "CARD_PAYMENT") delta = amount.negated();
    else if (r.type === "TRANSFER") delta = r.accountId === accountId ? amount.negated() : amount;
    balance = balance.plus(delta);
    lines.push({
      transaction: toTransactionDTO(r, today),
      delta: toMoneyString(delta),
      balanceAfter: toMoneyString(balance),
    });
  }
  const scheduled = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      status: "PENDING",
      dueDate: { gte: toDbDate(start), lte: toDbDate(end) },
      OR: [{ accountId }, { transferAccountId: accountId }],
    },
    include,
    orderBy: { dueDate: "asc" },
  });
  return {
    opening: toMoneyString(opening),
    closing: toMoneyString(balance),
    lines,
    scheduled: scheduled.map((r) => toTransactionDTO(r, today)),
  };
}

/** Contas e categorias ativas para os formulários (carregadas uma vez no layout). */
export async function loadFormOptions(ctx: ServiceContext): Promise<FormOptions> {
  const [accounts, cards, income, expense] = await Promise.all([
    listAccountOptions(ctx),
    prisma.creditCard.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null },
      select: { id: true, name: true, color: true, closingDay: true, dueDay: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getCategoryTree(ctx, { kind: "INCOME" }),
    getCategoryTree(ctx, { kind: "EXPENSE" }),
  ]);
  return { accounts, cards, categories: { income, expense } };
}

export interface FixedExpensesSummary {
  /** Despesas de natureza fixa com vencimento no mês. */
  monthly: string;
  /** Soma das fixas dos próximos 12 meses a partir do mês escolhido (inclui anuais e trimestrais). */
  yearly: string;
  /** Renda base prevista do mês (categorias de classe Base). */
  baseIncome: string;
  /** Fixas ÷ renda base (null sem renda base). */
  shareOfBase: string | null;
  /** Fixas ÷ renda total prevista (null sem renda). */
  shareOfIncome: string | null;
}

/** Despesas fixas (regra R5): mensal, anual e peso sobre a renda base. */
export async function fixedExpensesSummary(
  ctx: ServiceContext,
  month: string,
): Promise<FixedExpensesSummary> {
  const { start, end } = monthRange(month);
  const yearEnd = monthRange(addMonthsToKey(month, 11)).end;
  const [rows, classes] = await Promise.all([
    prisma.$queryRaw<{ monthly: string | null; yearly: string | null }[]>(Prisma.sql`
      SELECT
        SUM(CASE WHEN due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)} THEN amount END)::text AS monthly,
        SUM(amount)::text AS yearly
      FROM fin_transactions
      WHERE workspace_id = ${ctx.workspaceId}::uuid AND deleted_at IS NULL AND type = 'EXPENSE' AND nature = 'FIXED'
        AND status <> 'CANCELED' AND is_balance_adjustment = false
        AND due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(yearEnd)}`),
    incomeByClass(ctx, month),
  ]);
  const monthly = toMoney(rows[0]?.monthly ?? 0);
  const yearly = toMoney(rows[0]?.yearly ?? 0);
  const base = toMoney(classes.find((c) => c.incomeClass === "BASE")?.total ?? 0);
  const income = classes.reduce((s, c) => s.plus(toMoney(c.total)), ZERO);
  return {
    monthly: toMoneyString(monthly),
    yearly: toMoneyString(yearly),
    baseIncome: toMoneyString(base),
    shareOfBase: base.isZero() ? null : monthly.dividedBy(base).toFixed(4),
    shareOfIncome: income.isZero() ? null : monthly.dividedBy(income).toFixed(4),
  };
}
