import { Prisma } from "@prisma/client";
import { addMonthsToKey, fromDbDate, type MonthKey, monthRange, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { toMoney, toMoneyString, sumMoney, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { type BudgetState, budgetProgress } from "./domain/status";

export interface BudgetRow {
  categoryId: string;
  name: string;
  parentName: string | null;
  icon: string;
  color: string;
  limit: string;
  spent: string;
  available: string;
  excess: string;
  ratio: string;
  state: BudgetState;
  thresholdPercent: number;
  /** Desde quando este limite vale. */
  since: MonthKey;
}

export interface UnbudgetedRow {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  spent: string;
  /** Sugestão: média dos 3 meses anteriores, arredondada para cima em R$ 50. */
  suggestion: string | null;
}

/** Gasto por categoria no mês (R0): grupo soma as subcategorias; estornos abatem. */
async function spentByCategory(workspaceId: string, month: MonthKey) {
  const { start, end } = monthRange(month);
  const rows = await prisma.$queryRaw<{ category_id: string; spent: string }[]>(Prisma.sql`
    SELECT category_id, SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE -amount END)::text AS spent
    FROM fin_transactions
    WHERE workspace_id = ${workspaceId}::uuid AND deleted_at IS NULL AND status <> 'CANCELED' AND is_balance_adjustment = false
      AND type IN ('EXPENSE', 'REFUND') AND category_id IS NOT NULL
      AND due_date BETWEEN ${toDbDate(start)} AND ${toDbDate(end)}
    GROUP BY category_id`);
  return new Map(rows.map((r) => [r.category_id, toMoney(r.spent)]));
}

export async function budgetOverview(ctx: ServiceContext, month: MonthKey) {
  const first = toDbDate(`${month}-01`);
  const [budgets, categories, spent] = await Promise.all([
    prisma.budget.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        effectiveFrom: { lte: first },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: first } }],
      },
    }),
    prisma.category.findMany({
      where: { workspaceId: ctx.workspaceId, kind: "EXPENSE" },
      orderBy: [{ sortOrder: "asc" }],
    }),
    spentByCategory(ctx.workspaceId, month),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).map((c) => c.id);
  const spentFor = (id: string) =>
    sumMoney([id, ...childrenOf(id)].map((x) => spent.get(x) ?? ZERO));

  const rows: BudgetRow[] = budgets
    .map((b) => {
      const c = byId.get(b.categoryId);
      if (!c) return null;
      const sp = spentFor(c.id);
      const p = budgetProgress(b.amount, sp, b.alertThresholdPercent);
      return {
        categoryId: c.id,
        name: c.name,
        parentName: c.parentId ? (byId.get(c.parentId)?.name ?? null) : null,
        icon: c.icon,
        color: c.color,
        limit: toMoneyString(b.amount),
        spent: toMoneyString(sp),
        available: toMoneyString(p.available),
        excess: toMoneyString(p.excess),
        ratio: p.ratio.toFixed(4),
        state: p.state,
        thresholdPercent: b.alertThresholdPercent,
        since: fromDbDate(b.effectiveFrom).slice(0, 7),
      };
    })
    .filter((r): r is BudgetRow => r !== null)
    .sort((a, b) => Number(b.ratio) - Number(a.ratio));

  // Categorias de 1º nível com gasto e sem limite.
  const budgetedIds = new Set(rows.map((r) => r.categoryId));
  const roots = categories.filter((c) => !c.parentId && !c.archivedAt && !budgetedIds.has(c.id));
  const previous = await Promise.all(
    [1, 2, 3].map((i) => spentByCategory(ctx.workspaceId, addMonthsToKey(month, -i))),
  );
  const unbudgeted: UnbudgetedRow[] = roots
    .map((c) => {
      const sp = spentFor(c.id);
      const hist = previous.map((m) =>
        sumMoney([c.id, ...childrenOf(c.id)].map((x) => m.get(x) ?? ZERO)),
      );
      const avg = sumMoney(hist).dividedBy(3);
      const suggestion = avg.greaterThan(0) ? avg.dividedBy(50).ceil().times(50) : null;
      return {
        categoryId: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        spent: toMoneyString(sp),
        suggestion: suggestion ? toMoneyString(suggestion) : null,
      };
    })
    .filter((r) => toMoney(r.spent).greaterThan(0) || r.suggestion)
    .sort((a, b) => toMoney(b.spent).comparedTo(toMoney(a.spent)));

  const totalLimit = sumMoney(rows.map((r) => r.limit));
  const totalSpent = sumMoney(rows.map((r) => r.spent));
  return {
    rows,
    unbudgeted,
    totalLimit: toMoneyString(totalLimit),
    totalSpent: toMoneyString(totalSpent),
    over: rows.filter((r) => r.state === "over").length,
    warning: rows.filter((r) => r.state === "warning").length,
  };
}
