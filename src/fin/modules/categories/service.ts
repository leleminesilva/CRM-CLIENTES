import type { Category } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError, normalizeError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { categoryRepository as repo } from "./repository";
import type { CreateCategoryInput, UpdateCategoryInput } from "./schemas";

async function getOwned(db: DbClient, ctx: ServiceContext, id: string): Promise<Category> {
  const category = await repo.findById(db, ctx.workspaceId, id);
  if (!category) throw new AppError("NOT_FOUND");
  return category;
}

/** Grupo válido: mesmo tipo, mesmo workspace, ativo e de 1º nível (hierarquia de 2 níveis). */
async function assertValidParent(
  db: DbClient,
  ctx: ServiceContext,
  parentId: string | null,
  kind: Category["kind"],
  selfId?: string,
) {
  if (!parentId) return;
  if (parentId === selfId) throw new AppError("CATEGORY_INVALID_PARENT");
  const parent = await repo.findById(db, ctx.workspaceId, parentId);
  if (!parent || parent.kind !== kind || parent.parentId !== null || parent.archivedAt) {
    throw new AppError("CATEGORY_INVALID_PARENT");
  }
}

async function assertNameAvailable(
  db: DbClient,
  ctx: ServiceContext,
  kind: Category["kind"],
  parentId: string | null,
  name: string,
  excludeId?: string,
) {
  const clash = await repo.findSibling(db, ctx.workspaceId, kind, parentId, name, excludeId);
  if (clash) throw new AppError("CATEGORY_NAME_TAKEN");
}

/** O índice único do banco é a última barreira: conflito vira mensagem de nome repetido. */
function rethrowNameConflict(error: unknown): never {
  const normalized = normalizeError(error);
  if (normalized instanceof AppError && normalized.code === "CONFLICT")
    throw new AppError("CATEGORY_NAME_TAKEN");
  throw normalized;
}

function classFields(
  kind: Category["kind"],
  input: Pick<CreateCategoryInput, "incomeClass" | "defaultNature" | "isEssential">,
) {
  return kind === "INCOME"
    ? { incomeClass: input.incomeClass ?? "OTHER", defaultNature: null, isEssential: false }
    : { incomeClass: null, defaultNature: input.defaultNature, isEssential: input.isEssential };
}

export async function createCategory(ctx: ServiceContext, input: CreateCategoryInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    await assertValidParent(tx, ctx, input.parentId, input.kind);
    await assertNameAvailable(tx, ctx, input.kind, input.parentId, input.name);
    const created = await tx.category
      .create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: input.kind,
          parentId: input.parentId,
          name: input.name,
          icon: input.icon,
          color: input.color,
          ...classFields(input.kind, input),
          sortOrder: await repo.nextSortOrder(tx, ctx.workspaceId, input.kind, input.parentId),
        },
      })
      .catch(rethrowNameConflict);
    await audit(tx, ctx, {
      action: "category.create",
      entityType: "Category",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateCategory(ctx: ServiceContext, input: UpdateCategoryInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await getOwned(tx, ctx, input.id);
    const moving = input.parentId !== before.parentId;
    if (moving) {
      if (before.systemKey)
        throw new AppError("CATEGORY_SYSTEM", "Categorias do sistema não podem mudar de grupo.");
      await assertValidParent(tx, ctx, input.parentId, before.kind, before.id);
      if (input.parentId) {
        const children = await tx.category.count({
          where: { parentId: before.id, archivedAt: null },
        });
        if (children > 0) throw new AppError("CATEGORY_HAS_CHILDREN");
      }
    }
    await assertNameAvailable(tx, ctx, before.kind, input.parentId, input.name, before.id);
    const after = await tx.category
      .update({
        where: { id: before.id },
        data: {
          name: input.name,
          parentId: input.parentId,
          icon: input.icon,
          color: input.color,
          ...classFields(before.kind, input),
          ...(moving
            ? {
                sortOrder: await repo.nextSortOrder(
                  tx,
                  ctx.workspaceId,
                  before.kind,
                  input.parentId,
                ),
              }
            : {}),
        },
      })
      .catch(rethrowNameConflict);
    // Subcategorias herdam a cor do grupo, para manter a identidade visual.
    if (before.parentId === null && before.color !== after.color) {
      await tx.category.updateMany({
        where: { parentId: before.id },
        data: { color: after.color },
      });
    }
    await audit(tx, ctx, {
      action: "category.update",
      entityType: "Category",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

/** Grava a nova ordem dos irmãos (mesmo grupo e tipo). IDs de fora do grupo são recusados. */
export async function reorderCategories(
  ctx: ServiceContext,
  input: { parentId: string | null; kind: Category["kind"]; orderedIds: string[] },
) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const siblings = await tx.category.findMany({
      where: { workspaceId: ctx.workspaceId, kind: input.kind, parentId: input.parentId },
      select: { id: true },
    });
    const known = new Set(siblings.map((s) => s.id));
    if (input.orderedIds.some((id) => !known.has(id))) throw new AppError("NOT_FOUND");
    for (const [index, id] of input.orderedIds.entries()) {
      await tx.category.update({ where: { id }, data: { sortOrder: index } });
    }
    await audit(tx, ctx, {
      action: "category.reorder",
      entityType: "Category",
      after: { parentId: input.parentId, order: input.orderedIds },
    });
  });
}

/** Arquivar esconde dos formulários sem perder histórico. Arquivar um grupo arquiva as subcategorias. */
export async function archiveCategory(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const category = await getOwned(tx, ctx, id);
    if (category.systemKey) throw new AppError("CATEGORY_SYSTEM");
    const now = new Date();
    await tx.category.update({ where: { id }, data: { archivedAt: now } });
    await tx.category.updateMany({
      where: { parentId: id, archivedAt: null },
      data: { archivedAt: now },
    });
    await audit(tx, ctx, { action: "category.archive", entityType: "Category", entityId: id });
  });
}

export async function unarchiveCategory(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const category = await getOwned(tx, ctx, id);
    if (category.parentId) {
      // Reativar uma subcategoria reativa o grupo, senão ela ficaria órfã na interface.
      await tx.category.update({ where: { id: category.parentId }, data: { archivedAt: null } });
    }
    await assertNameAvailable(
      tx,
      ctx,
      category.kind,
      category.parentId,
      category.name,
      category.id,
    );
    await tx.category
      .update({ where: { id }, data: { archivedAt: null } })
      .catch(rethrowNameConflict);
    await audit(tx, ctx, { action: "category.unarchive", entityType: "Category", entityId: id });
  });
}

/** Exclusão definitiva: só para categorias sem uso e sem subcategorias. Com uso, o caminho é mesclar. */
export async function deleteCategory(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const category = await getOwned(tx, ctx, id);
    if (category.systemKey) throw new AppError("CATEGORY_SYSTEM");
    if ((await tx.category.count({ where: { parentId: id } })) > 0)
      throw new AppError("CATEGORY_HAS_CHILDREN");
    if ((await repo.usage(tx, id)).total > 0) throw new AppError("CATEGORY_IN_USE");
    await tx.category.delete({ where: { id } });
    await audit(tx, ctx, {
      action: "category.delete",
      entityType: "Category",
      entityId: id,
      before: category,
    });
  });
}

/**
 * Move tudo o que usa a origem (lançamentos, recorrências, parcelamentos, orçamentos e
 * subcategorias) para o destino e exclui a origem.
 */
export async function mergeCategories(ctx: ServiceContext, sourceId: string, targetId: string) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const source = await getOwned(tx, ctx, sourceId);
    const target = await getOwned(tx, ctx, targetId);
    if (source.systemKey) throw new AppError("CATEGORY_SYSTEM");
    if (source.kind !== target.kind) throw new AppError("CATEGORY_MERGE_KIND");
    if (target.parentId === source.id) {
      throw new AppError(
        "CATEGORY_INVALID_PARENT",
        "Não é possível mesclar um grupo numa das próprias subcategorias.",
      );
    }

    const children = await tx.category.findMany({ where: { parentId: source.id } });
    if (children.length > 0) {
      if (target.parentId !== null) throw new AppError("CATEGORY_HAS_CHILDREN");
      let order = await repo.nextSortOrder(tx, ctx.workspaceId, target.kind, target.id);
      for (const child of children) {
        await tx.category.update({
          where: { id: child.id },
          data: { parentId: target.id, color: target.color, sortOrder: order++ },
        });
      }
    }

    const moved = await Promise.all([
      tx.transaction.updateMany({
        where: { categoryId: source.id },
        data: { categoryId: target.id },
      }),
      tx.recurrence.updateMany({
        where: { categoryId: source.id },
        data: { categoryId: target.id },
      }),
      tx.installmentPlan.updateMany({
        where: { categoryId: source.id },
        data: { categoryId: target.id },
      }),
    ]);
    // Orçamentos: se o destino já tem limite no mesmo mês, o do destino prevalece.
    const sourceBudgets = await tx.budget.findMany({ where: { categoryId: source.id } });
    for (const budget of sourceBudgets) {
      const clash = await tx.budget.findUnique({
        where: {
          categoryId_effectiveFrom: { categoryId: target.id, effectiveFrom: budget.effectiveFrom },
        },
      });
      if (clash) await tx.budget.delete({ where: { id: budget.id } });
      else await tx.budget.update({ where: { id: budget.id }, data: { categoryId: target.id } });
    }

    await tx.category.delete({ where: { id: source.id } });
    await audit(tx, ctx, {
      action: "category.merge",
      entityType: "Category",
      entityId: target.id,
      before: { source: source.name },
      after: {
        target: target.name,
        transactions: moved[0].count,
        recurrences: moved[1].count,
        installmentPlans: moved[2].count,
      },
    });
    return { movedTransactions: moved[0].count };
  });
}
