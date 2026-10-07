// Portado de Financeiro/src/lib/permissions.ts.
import type { WorkspaceRole } from "@prisma/client";
import { AppError } from "./errors";

/** O que todo service recebe: quem está agindo e em qual workspace. Nunca lido da sessão dentro do service. */
export interface ServiceContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export type Permission = "read" | "write" | "manage" | "owner";

const rank: Record<WorkspaceRole, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };
const minimumRole: Record<Permission, WorkspaceRole> = {
  read: "VIEWER",
  write: "MEMBER",
  manage: "ADMIN",
  owner: "OWNER",
};

export function can(ctx: Pick<ServiceContext, "role">, permission: Permission): boolean {
  return rank[ctx.role] >= rank[minimumRole[permission]];
}

export function assertCan(ctx: Pick<ServiceContext, "role">, permission: Permission): void {
  if (!can(ctx, permission)) throw new AppError("FORBIDDEN");
}
