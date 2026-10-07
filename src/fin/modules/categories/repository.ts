import type { CategoryKind } from "@prisma/client";
import type { DbClient } from "@fin/lib/db";

/** Acesso a dados de categorias — sempre restrito ao workspace. */
export const categoryRepository = {
  list(db: DbClient, workspaceId: string, kind?: CategoryKind) {
    return db.category.findMany({
      where: { workspaceId, ...(kind ? { kind } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },

  findById(db: DbClient, workspaceId: string, id: string) {
    return db.category.findFirst({ where: { id, workspaceId } });
  },

  /** Outra categoria ativa com o mesmo nome no mesmo nível (sem diferenciar maiúsculas). */
  findSibling(
    db: DbClient,
    workspaceId: string,
    kind: CategoryKind,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ) {
    return db.category.findFirst({
      where: {
        workspaceId,
        kind,
        parentId,
        archivedAt: null,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  async nextSortOrder(
    db: DbClient,
    workspaceId: string,
    kind: CategoryKind,
    parentId: string | null,
  ) {
    const last = await db.category.aggregate({
      where: { workspaceId, kind, parentId },
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? -1) + 1;
  },

  /** Quantos registros dependem da categoria. */
  async usage(db: DbClient, id: string) {
    const [transactions, recurrences, installmentPlans, budgets] = await Promise.all([
      db.transaction.count({ where: { categoryId: id } }),
      db.recurrence.count({ where: { categoryId: id } }),
      db.installmentPlan.count({ where: { categoryId: id } }),
      db.budget.count({ where: { categoryId: id } }),
    ]);
    return {
      transactions,
      recurrences,
      installmentPlans,
      budgets,
      total: transactions + recurrences + installmentPlans + budgets,
    };
  },

  /** Contagem de lançamentos (não excluídos) por categoria. */
  async transactionCounts(db: DbClient, workspaceId: string) {
    const rows = await db.transaction.groupBy({
      by: ["categoryId"],
      where: { workspaceId, deletedAt: null, categoryId: { not: null } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.categoryId as string, r._count._all]));
  },
};
