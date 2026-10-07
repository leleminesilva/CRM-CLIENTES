import prisma from "@/lib/prisma";
import { canAccessFinanceiro } from "@/lib/rbac";
import { AppError } from "./errors";
import type { ServiceContext } from "./permissions";
import { ensureBusinessWorkspace, syncMembership, workspaceRoleFor } from "./workspace";

/** Data ISO "YYYY-MM-DD". */
export type ISODate = string;

export interface FinContext extends ServiceContext {
  user: { id: string; name: string; email: string };
  workspace: { id: string; name: string; timezone: string; isDemo: boolean };
  /** Workspaces acessíveis (no CRM, só o da empresa). */
  workspaces: { id: string; name: string; isDemo: boolean }[];
  /** "Hoje" no fuso do workspace. */
  today: ISODate;
}

function todayIn(timezone: string): ISODate {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

/**
 * Contexto do Financeiro para um usuário do CRM. Sem dependência do Next (cookies, cache),
 * para servir também a scripts e testes. null = usuário inexistente ou inativo.
 */
export async function resolveFinContext(userId: string): Promise<FinContext | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, ativo: true },
    select: { id: true, nome: true, email: true, role: true, acessoFinanceiro: true },
  });
  if (!user) return null;
  if (!canAccessFinanceiro(user)) throw new AppError("FORBIDDEN");

  const workspace = await ensureBusinessWorkspace();
  const role = workspaceRoleFor(user.role);
  await syncMembership(workspace.id, user.id, role);

  return {
    userId: user.id,
    workspaceId: workspace.id,
    role,
    user: { id: user.id, name: user.nome, email: user.email },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
      isDemo: workspace.isDemo,
    },
    workspaces: [{ id: workspace.id, name: workspace.name, isDemo: workspace.isDemo }],
    today: todayIn(workspace.timezone),
  };
}
