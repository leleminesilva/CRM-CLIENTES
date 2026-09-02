import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import type { JWTPayload } from "@/types";
import { SessionManager, calcularHealthStatus, type HealthStatus } from "./session-manager";
import { waLogger } from "./logger";
import type { WhatsAppSessao, WhatsAppSessaoStatus } from "@prisma/client";

// Regras de negócio do módulo (validação, posse, orquestração) — nunca fala
// com o provider diretamente, sempre através do SessionManager. Ver
// docs/architecture/whatsapp.md.

export type SessaoComHealth = WhatsAppSessao & {
  healthStatus: HealthStatus;
  atendente: { id: string; nome: string } | null;
};

const SELECT_SESSAO_SEGURO = {
  id: true,
  nome: true,
  numero: true,
  provider: true,
  providerVersion: true,
  status: true,
  ultimoPing: true,
  ultimaMensagemRecebida: true,
  lastError: true,
  lastErrorAt: true,
  atendenteId: true,
  empresaId: true,
  ativo: true,
  createdAt: true,
  updatedAt: true,
  providerSessionId: true, // necessário internamente; nunca inclui accessToken/apikey — não existe esse campo neste model
  atendente: { select: { id: true, nome: true } },
} as const;

// "Ver/gerenciar tudo" no WhatsApp é só Admin e Dev — Gestor NÃO (diferente do
// canViewAll genérico do resto do CRM). Ver docs/architecture/whatsapp.md.
function semPosse(sessao: Pick<WhatsAppSessao, "atendenteId">, payload: JWTPayload): boolean {
  return !isAdmin(payload.role) && sessao.atendenteId !== payload.userId;
}

export const WhatsAppService = {
  async listarSessoes(
    payload: JWTPayload,
    escopo: "minhas" | "todas" = "minhas"
  ): Promise<SessaoComHealth[]> {
    const verTodas = escopo === "todas" && isAdmin(payload.role);
    const sessoes = await prisma.whatsAppSessao.findMany({
      where: {
        ativo: true,
        ...(verTodas ? {} : { atendenteId: payload.userId }),
      },
      select: SELECT_SESSAO_SEGURO,
      orderBy: { createdAt: "asc" },
    });
    return sessoes.map((s) => ({ ...s, healthStatus: calcularHealthStatus(s) })) as SessaoComHealth[];
  },

  async criarSessao(
    payload: JWTPayload,
    nome: string,
    atendenteIdSolicitado: string | null
  ): Promise<WhatsAppSessao> {
    const admin = isAdmin(payload.role);
    // Cargo comum só cria a PRÓPRIA sessão, e no máximo uma ativa.
    const atendenteId = admin ? atendenteIdSolicitado ?? null : payload.userId;
    if (!admin) {
      const jaTem = await prisma.whatsAppSessao.count({
        where: { ativo: true, atendenteId: payload.userId },
      });
      if (jaTem > 0) throw new LimiteSessaoError();
    }
    waLogger.info("criando sessão", { sessionId: undefined, userId: payload.userId });
    return SessionManager.criar(nome, atendenteId);
  },

  async obterQrCode(
    sessaoId: string,
    payload: JWTPayload
  ): Promise<{ qrCode: string | null; status: WhatsAppSessaoStatus }> {
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    if (semPosse(sessao, payload)) throw new PosseError();
    return SessionManager.obterQrCode(sessaoId);
  },

  async desconectarSessao(sessaoId: string, payload: JWTPayload): Promise<void> {
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    if (semPosse(sessao, payload)) throw new PosseError();
    await SessionManager.desconectar(sessaoId);
  },

  async reiniciarSessao(sessaoId: string, payload: JWTPayload): Promise<void> {
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    if (semPosse(sessao, payload)) throw new PosseError();
    await SessionManager.reiniciar(sessaoId);
  },

  async excluirSessao(sessaoId: string, payload: JWTPayload): Promise<void> {
    // Dono exclui a própria; Admin/Dev excluem qualquer uma. Remove a
    // instância no gateway (Evolution) e faz soft-delete no CRM.
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    if (semPosse(sessao, payload)) throw new PosseError();
    await SessionManager.excluir(sessaoId);
  },

  async reatribuirAtendente(sessaoId: string, atendenteId: string | null): Promise<WhatsAppSessao> {
    return SessionManager.reatribuirAtendente(sessaoId, atendenteId);
  },

  async listarLogs(sessaoId: string, payload: JWTPayload) {
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    if (semPosse(sessao, payload)) throw new PosseError();
    return prisma.whatsAppSessaoLog.findMany({
      where: { sessaoId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },
};

export class PosseError extends Error {
  constructor() {
    super("Você não tem acesso a esta sessão");
    this.name = "PosseError";
  }
}

export class LimiteSessaoError extends Error {
  constructor() {
    super("Você já tem uma sessão de WhatsApp. Remova a atual antes de criar outra.");
    this.name = "LimiteSessaoError";
  }
}
