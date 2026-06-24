import type { Role } from "@/types";

type Permission =
  | "dashboard:view"
  | "dashboard:view_all"
  | "clientes:read"
  | "clientes:create"
  | "clientes:update"
  | "clientes:delete"
  | "clientes:read_all"
  | "leads:read"
  | "leads:create"
  | "leads:update"
  | "leads:delete"
  | "leads:read_all"
  | "oportunidades:read"
  | "oportunidades:create"
  | "oportunidades:update"
  | "oportunidades:delete"
  | "oportunidades:read_all"
  | "empresas:read"
  | "empresas:create"
  | "empresas:update"
  | "empresas:delete"
  | "contatos:read"
  | "contatos:create"
  | "contatos:update"
  | "contatos:delete"
  | "tarefas:read"
  | "tarefas:create"
  | "tarefas:update"
  | "tarefas:delete"
  | "tarefas:read_all"
  | "relatorios:view"
  | "usuarios:read"
  | "usuarios:create"
  | "usuarios:update"
  | "usuarios:delete"
  | "auditoria:view"
  | "configuracoes:view"
  | "configuracoes:update";

const PERMISSIONS: Record<Role, Permission[]> = {
  ADMINISTRADOR: [
    "dashboard:view",
    "dashboard:view_all",
    "clientes:read",
    "clientes:create",
    "clientes:update",
    "clientes:delete",
    "clientes:read_all",
    "leads:read",
    "leads:create",
    "leads:update",
    "leads:delete",
    "leads:read_all",
    "oportunidades:read",
    "oportunidades:create",
    "oportunidades:update",
    "oportunidades:delete",
    "oportunidades:read_all",
    "empresas:read",
    "empresas:create",
    "empresas:update",
    "empresas:delete",
    "contatos:read",
    "contatos:create",
    "contatos:update",
    "contatos:delete",
    "tarefas:read",
    "tarefas:create",
    "tarefas:update",
    "tarefas:delete",
    "tarefas:read_all",
    "relatorios:view",
    "usuarios:read",
    "usuarios:create",
    "usuarios:update",
    "usuarios:delete",
    "auditoria:view",
    "configuracoes:view",
    "configuracoes:update",
  ],
  GESTOR: [
    "dashboard:view",
    "dashboard:view_all",
    "clientes:read",
    "clientes:create",
    "clientes:update",
    "clientes:delete",
    "clientes:read_all",
    "leads:read",
    "leads:create",
    "leads:update",
    "leads:delete",
    "leads:read_all",
    "oportunidades:read",
    "oportunidades:create",
    "oportunidades:update",
    "oportunidades:delete",
    "oportunidades:read_all",
    "empresas:read",
    "empresas:create",
    "empresas:update",
    "empresas:delete",
    "contatos:read",
    "contatos:create",
    "contatos:update",
    "contatos:delete",
    "tarefas:read",
    "tarefas:create",
    "tarefas:update",
    "tarefas:delete",
    "tarefas:read_all",
    "relatorios:view",
    "configuracoes:view",
  ],
  COMERCIAL: [
    "dashboard:view",
    "clientes:read",
    "clientes:create",
    "clientes:update",
    "leads:read",
    "leads:create",
    "leads:update",
    "oportunidades:read",
    "oportunidades:create",
    "oportunidades:update",
    "empresas:read",
    "empresas:create",
    "empresas:update",
    "contatos:read",
    "contatos:create",
    "contatos:update",
    "tarefas:read",
    "tarefas:create",
    "tarefas:update",
    "tarefas:delete",
  ],
  OPERACIONAL: [
    "dashboard:view",
    "leads:read",
    "oportunidades:read",
    "empresas:read",
    "contatos:read",
    "tarefas:read",
    "tarefas:create",
    "tarefas:update",
    "tarefas:delete",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error("Permissão negada");
  }
}

export function canViewAll(role: Role): boolean {
  return role === "ADMINISTRADOR" || role === "GESTOR";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMINISTRADOR";
}

export function buildWhereClause(
  role: Role,
  userId: string,
  field: string = "responsavelId"
): Record<string, unknown> {
  if (canViewAll(role)) return {};
  return { [field]: userId };
}
