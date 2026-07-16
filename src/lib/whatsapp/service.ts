import prisma from "@/lib/prisma";
import { canViewAll } from "@/lib/rbac";
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

function semPosse(sessao: Pick<WhatsAppSessao, "atendenteId">, payload: JWTPayload): boolean {
  return !canViewAll(payload.role) && sessao.atendenteId !== payload.userId;
}

export const WhatsAppService = {
  async listarSessoes(payload: JWTPayload): Promise<SessaoComHealth[]> {
    const sessoes = await prisma.whatsAppSessao.findMany({
      where: {
        ativo: true,
        ...(canViewAll(payload.role) ? {} : { atendenteId: payload.userId }),
      },
      select: SELECT_SESSAO_SEGURO,
      orderBy: { createdAt: "asc" },
    });
    return sessoes.map((s) => ({ ...s, healthStatus: calcularHealthStatus(s) })) as SessaoComHealth[];
  },

  async criarSessao(nome: string, atendenteId: string | null): Promise<WhatsAppSessao> {
    waLogger.info("criando sessão", { sessionId: undefined });
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

  async excluirSessao(sessaoId: string): Promise<void> {
    // Só quem tem whatsapp:manage_sessoes chega aqui (checado no controller) —
    // gestão de sessão não é uma operação de posse do atendente.
    await SessionManager.excluir(sessaoId);
  },

  async reatribuirAtendente(sessaoId: string, atendenteId: string | null): Promise<WhatsAppSessao> {
    return SessionManager.reatribuirAtendente(sessaoId, atendenteId);
  },
};

export class PosseError extends Error {
  constructor() {
    super("Você não tem acesso a esta sessão");
    this.name = "PosseError";
  }
}
