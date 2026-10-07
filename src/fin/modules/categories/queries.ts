import type { CategoryKind } from "@prisma/client";
import { prisma } from "@fin/lib/db";
import type { ServiceContext } from "@fin/lib/permissions";
import { categoryRepository as repo } from "./repository";
import type { CategoryDTO, CategoryNode } from "./types";

/** Árvore de categorias (grupos com subcategorias), na ordem definida pelo usuário. */
export async function getCategoryTree(
  ctx: ServiceContext,
  options: { kind?: CategoryKind; includeArchived?: boolean } = {},
): Promise<CategoryNode[]> {
  const [rows, counts] = await Promise.all([
    repo.list(prisma, ctx.workspaceId, options.kind),
    repo.transactionCounts(prisma, ctx.workspaceId),
  ]);
  const visible = options.includeArchived ? rows : rows.filter((r) => r.archivedAt === null);
  const dto = (r: (typeof rows)[number]): CategoryDTO => ({
    id: r.id,
    kind: r.kind,
    parentId: r.parentId,
    name: r.name,
    icon: r.icon,
    color: r.color,
    incomeClass: r.incomeClass,
    defaultNature: r.defaultNature,
    isEssential: r.isEssential,
    isSystem: r.systemKey !== null,
    archived: r.archivedAt !== null,
    sortOrder: r.sortOrder,
    usage: counts.get(r.id) ?? 0,
  });

  const roots = visible
    .filter((r) => r.parentId === null)
    .map((r) => ({ ...dto(r), children: [] as CategoryDTO[] }));
  const byId = new Map(roots.map((r) => [r.id, r]));
  for (const row of visible) {
    if (row.parentId) byId.get(row.parentId)?.children.push(dto(row));
  }
  return roots;
}
