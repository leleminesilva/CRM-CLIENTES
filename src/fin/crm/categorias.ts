import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Categoria de sistema por chave (systemKey). Se ainda não existe mas já há uma categoria de
 * primeiro nível com o mesmo nome e tipo (ex.: copiada do Caixa antigo, ou criada à mão), ela é
 * adotada em vez de duplicada — o nome é único por tipo.
 */
export async function ensureSystemCategory(
  db: Tx,
  workspaceId: string,
  spec: { systemKey: string; create: Omit<Prisma.CategoryUncheckedCreateInput, "workspaceId" | "systemKey"> },
) {
  const { systemKey, create } = spec;
  const system = await db.category.findFirst({ where: { workspaceId, systemKey } });
  if (system) return system;
  const twin = await db.category.findFirst({
    where: {
      workspaceId,
      kind: create.kind,
      parentId: null,
      name: { equals: create.name, mode: "insensitive" },
    },
  });
  if (twin) {
    return db.category.update({
      where: { id: twin.id },
      data: { systemKey, archivedAt: null },
    });
  }
  return db.category.create({ data: { ...create, workspaceId, systemKey } });
}
