import { randomBytes } from "node:crypto";
import type { WorkspaceKind } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { createDefaultCategories } from "@fin/modules/categories/defaults";

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`;
}

export interface CreateWorkspaceInput {
  name: string;
  kind?: WorkspaceKind;
  isDemo?: boolean;
}

/** Cria o workspace, o vínculo de proprietário e as categorias padrão, numa única transação. */
export async function createWorkspaceForUser(userId: string, input: CreateWorkspaceInput) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: input.name,
        slug: slugify(input.name),
        kind: input.kind ?? "PERSONAL",
        isDemo: input.isDemo ?? false,
      },
    });
    await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: "OWNER" } });
    await createDefaultCategories(tx, workspace.id);
    await tx.finAuditLog.create({
      data: {
        workspaceId: workspace.id,
        userId,
        action: "workspace.create",
        entityType: "Workspace",
        entityId: workspace.id,
      },
    });
    return workspace;
  });
}

/** Garante que o usuário tenha um workspace pessoal (autocorreção caso a criação no cadastro falhe). */
export async function ensurePersonalWorkspace(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({ where: { userId } });
  if (existing) return;
  await createWorkspaceForUser(userId, { name: "Pessoal" });
}

export async function listMemberships(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: { select: { id: true, name: true, isDemo: true, kind: true, timezone: true } },
    },
    orderBy: [{ workspace: { isDemo: "asc" } }, { createdAt: "asc" }],
  });
}

export async function renameWorkspace(ctx: ServiceContext, name: string) {
  assertCan(ctx, "manage");
  const before = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
  const after = await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { name } });
  await audit(prisma, ctx, {
    action: "workspace.rename",
    entityType: "Workspace",
    entityId: ctx.workspaceId,
    before: { name: before.name },
    after: { name: after.name },
  });
  return after;
}

/**
 * Exclui um workspace inteiro (ex.: o de demonstração). Exige ser proprietário e nunca
 * remove o último workspace real do usuário.
 */
export async function deleteWorkspace(ctx: ServiceContext, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: ctx.userId } },
    include: { workspace: true },
  });
  if (!membership) throw new AppError("NOT_FOUND");
  assertCan(membership, "owner");
  if (!membership.workspace.isDemo) {
    const realWorkspaces = await prisma.workspaceMember.count({
      where: { userId: ctx.userId, workspace: { isDemo: false } },
    });
    if (realWorkspaces <= 1) {
      throw new AppError(
        "FORBIDDEN",
        "Este é o seu único workspace com dados reais e não pode ser excluído.",
      );
    }
  }
  await prisma.workspace.delete({ where: { id: workspaceId } });
}
