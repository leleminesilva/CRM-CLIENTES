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
  // WhatsApp: Admin e Dev gerenciam qualquer sessão e enxergam as de todos
  // (toggle "Minhas/Todas" na UI). Os demais cargos têm só `whatsapp:use` —
  // criam/conectam/excluem a PRÓPRIA sessão (1 por pessoa) e só veem a sua.
  // Ver docs/architecture/whatsapp.md ("Como funciona o RBAC").
  "whatsapp:manage_sessoes",
  "whatsapp:use",
];

const PERMISSIONS: Record<Role, Permission[]> = {
  ADMINISTRADOR: ADMIN_PERMISSIONS,
  DESENVOLVEDOR: ADMIN_PERMISSIONS,
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
    "whatsapp:use",
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
    "whatsapp:use",
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
    "whatsapp:use",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  if (permission === "whatsapp:use" || permission === "whatsapp:manage_sessoes") {
    if (WHATSAPP_STANDBY) return false;
    // Por enquanto o módulo WhatsApp é liberado só para o Desenvolvedor —
    // Administrador e demais cargos não veem a sidebar nem acessam as rotas.
    // Para reabrir a todos, remova este check (o mapa PERMISSIONS abaixo já
    // concede a permissão aos outros cargos).
    if (role !== "DESENVOLVEDOR") return false;
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
