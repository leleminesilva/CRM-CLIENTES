import { Prisma, type Role, type WorkspaceRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";

// O sistema novo foi feito multi-workspace; no CRM há um só, o da empresa.
// Slug fixo: é a chave do upsert, então dois acessos simultâneos não criam dois workspaces.
export const BUSINESS_WORKSPACE_SLUG = "infinity-glass";

// Categorias que os módulos procuram por systemKey (comissões, encargos de cartão).
// A árvore padrão do sistema novo é de finanças pessoais e fica de fora: as categorias
// da empresa vêm do Caixa atual na migração (Fase 3).
const SYSTEM_CATEGORIES: Prisma.CategoryCreateManyInput[] = [
  {
    workspaceId: "",
    kind: "INCOME",
    name: "Comissões",
    icon: "badge-percent",
    color: "#2a78d6",
    incomeClass: "COMMISSION",
    systemKey: "commission",
  },
  {
    workspaceId: "",
    kind: "EXPENSE",
    name: "Encargos do cartão",
    icon: "percent",
    color: "#e34948",
    defaultNature: "VARIABLE",
    systemKey: "card_fees",
  },
];

/** Admin/Dev do CRM são proprietários; quem recebeu "acesso ao Financeiro" administra. */
export function workspaceRoleFor(role: Role): WorkspaceRole {
  return isAdmin(role) ? "OWNER" : "ADMIN";
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Garante o workspace da empresa e suas categorias de sistema. Idempotente e seguro com
 * acessos simultâneos: o upsert do Prisma 5 lê e depois insere, então quem perde a corrida
 * recebe P2002 e relê o registro criado pelo outro.
 */
export async function ensureBusinessWorkspace() {
  const existing = await prisma.workspace.findUnique({ where: { slug: BUSINESS_WORKSPACE_SLUG } });
  if (existing) return existing;
  try {
    return await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: "Infinity Glass", slug: BUSINESS_WORKSPACE_SLUG, kind: "BUSINESS" },
      });
      await tx.category.createMany({
        data: SYSTEM_CATEGORIES.map((c) => ({ ...c, workspaceId: workspace.id })),
      });
      return workspace;
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return prisma.workspace.findUniqueOrThrow({ where: { slug: BUSINESS_WORKSPACE_SLUG } });
  }
}

/** Mantém o vínculo do usuário com o papel atual (o cargo no CRM pode mudar a qualquer momento). */
export async function syncMembership(workspaceId: string, userId: string, role: WorkspaceRole) {
  const where = { workspaceId_userId: { workspaceId, userId } };
  const member = await prisma.workspaceMember.findUnique({ where, select: { role: true } });
  if (member) {
    if (member.role !== role) await prisma.workspaceMember.update({ where, data: { role } });
    return;
  }
  try {
    await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}
