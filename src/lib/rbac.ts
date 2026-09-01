import type { Role } from "@/types";

// Módulo WhatsApp em standby: Fase 5 (VPS/Evolution real) ainda não
// provisionada — pausado até a instância existir. (O drift de schema que
// também motivou o standby já foi reconciliado: `prisma migrate diff` contra
// produção e local dá vazio.)
//
// Destravado só onde NEXT_PUBLIC_WHATSAPP_STANDBY estiver explicitamente em
// "false"; a ausência da env mantém o standby LIGADO (seguro por padrão), então
// produção continua congelada até setarmos a env na Vercel. É NEXT_PUBLIC_
// porque a página client (src/app/(dashboard)/whatsapp/page.tsx) também lê
// essa flag — e "o módulo está no ar?" não é segredo. Ver docs/architecture/whatsapp.md.
export const WHATSAPP_STANDBY = process.env.NEXT_PUBLIC_WHATSAPP_STANDBY !== "false";

type Permission =
  | "dashboard:view"
  | "dashboard:view_all"
  | "pesquisa:view"
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
  | "configuracoes:update"
  | "whatsapp:manage_sessoes"
  | "whatsapp:use";

// Desenvolvedor tem acesso total, igual Administrador.
const ADMIN_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "dashboard:view_all",
  "pesquisa:view",
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
];

const PERMISSIONS: Record<Role, Permission[]> = {
  ADMINISTRADOR: ADMIN_PERMISSIONS,
  // WhatsApp (gateway self-hosted) fica restrito só a Desenvolvedor por
  // enquanto, deliberadamente à parte de ADMIN_PERMISSIONS — feature nova,
  // ainda não validada em produção. Ver docs/architecture/whatsapp.md.
  DESENVOLVEDOR: [...ADMIN_PERMISSIONS, "whatsapp:manage_sessoes", "whatsapp:use"],
  GESTOR: [
    "dashboard:view",
    "dashboard:view_all",
    "pesquisa:view",
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
    "pesquisa:view",
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
    "pesquisa:view",
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
  if (WHATSAPP_STANDBY && (permission === "whatsapp:use" || permission === "whatsapp:manage_sessoes")) {
    return false;
  }
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error("Permissão negada");
  }
}

export function canViewAll(role: Role): boolean {
  return role === "ADMINISTRADOR" || role === "DESENVOLVEDOR" || role === "GESTOR";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMINISTRADOR" || role === "DESENVOLVEDOR";
}

export function buildWhereClause(
  role: Role,
  userId: string,
  field: string = "responsavelId"
): Record<string, unknown> {
  if (canViewAll(role)) return {};
  return { [field]: userId };
}
