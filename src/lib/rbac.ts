import type { Role } from "@/types";

// Módulo WhatsApp em standby: Fase 5 (VPS/Evolution real) ainda não
// provisionada e a migração de schema mais recente (whatsapp_conversas)
// ficou inconsistente em produção — pausado até resolver, sem mexer em dados.
// Reverter: virar pra `false`. Ver docs/architecture/whatsapp.md.
export const WHATSAPP_STANDBY = true;

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
  | "whatsapp:use"
  | "catalogo:read"
  | "catalogo:create"
  | "catalogo:update"
  | "catalogo:delete"
  | "orcamentos_tecnicos:read"
  | "orcamentos_tecnicos:create"
  | "orcamentos_tecnicos:update"
  | "orcamentos_tecnicos:delete"
  | "orcamentos_tecnicos:aprovar"
  | "ordens_servico:read"
  | "ordens_servico:update"
  | "sobras_material:read"
  | "sobras_material:create"
  | "sobras_material:update"
  | "sobras_material:delete";

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
  DESENVOLVEDOR: [
    ...ADMIN_PERMISSIONS,
    "whatsapp:manage_sessoes",
    "whatsapp:use",
    // Orçamentos Técnicos (motor de cálculo por vão/vidro, ordens de serviço,
    // sobras de material) — módulo novo, deliberadamente à parte de
    // ADMIN_PERMISSIONS: nem Administrador tem acesso por enquanto.
    // Ver docs/architecture/orcamentos-tecnicos.md.
    "catalogo:read",
    "catalogo:create",
    "catalogo:update",
    "catalogo:delete",
    "orcamentos_tecnicos:read",
    "orcamentos_tecnicos:create",
    "orcamentos_tecnicos:update",
    "orcamentos_tecnicos:delete",
    "orcamentos_tecnicos:aprovar",
    "ordens_servico:read",
    "ordens_servico:update",
    "sobras_material:read",
    "sobras_material:create",
    "sobras_material:update",
    "sobras_material:delete",
  ],
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
