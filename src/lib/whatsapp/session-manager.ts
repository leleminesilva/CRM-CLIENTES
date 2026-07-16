import prisma from "@/lib/prisma";
import type { WhatsAppSessao, WhatsAppSessaoStatus, WhatsAppSessaoEvento } from "@prisma/client";
import { getProvider } from "./providers";

// Isola o lado técnico da conexão (lifecycle, health, transição de estado)
// das regras de negócio, que ficam no WhatsAppService — ver
// docs/architecture/whatsapp.md.

// Transições válidas de status. Qualquer transição fora dessa lista é
// rejeitada — ver "Máquina de estados da sessão" no documento de arquitetura.
const TRANSICOES_VALIDAS: Record<WhatsAppSessaoStatus, WhatsAppSessaoStatus[]> = {
  UNKNOWN: ["WAITING_QR", "ERROR"],
  WAITING_QR: ["ONLINE", "ERROR", "WAITING_QR"],
  ONLINE: ["RECONNECTING", "OFFLINE", "ERROR"],
  RECONNECTING: ["ONLINE", "OFFLINE", "ERROR"],
  OFFLINE: ["WAITING_QR", "ERROR"],
  ERROR: ["WAITING_QR", "OFFLINE"],
};

function transicaoValida(de: WhatsAppSessaoStatus, para: WhatsAppSessaoStatus): boolean {
  return de === para || (TRANSICOES_VALIDAS[de]?.includes(para) ?? false);
}

// Limite pra considerar uma sessão ONLINE "congelada" (ver Health vs. status).
const LIMITE_SAUDE_MS = 6 * 60 * 60 * 1000; // 6h sem sinal de vida

export type HealthStatus = "HEALTHY" | "STALE" | "UNKNOWN";

export function calcularHealthStatus(sessao: Pick<WhatsAppSessao, "status" | "ultimoPing" | "ultimaMensagemRecebida">): HealthStatus {
  if (sessao.status !== "ONLINE") return "UNKNOWN";
  const sinalMaisRecente = [sessao.ultimoPing, sessao.ultimaMensagemRecebida]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!sinalMaisRecente) return "UNKNOWN";
  return Date.now() - sinalMaisRecente.getTime() > LIMITE_SAUDE_MS ? "STALE" : "HEALTHY";
}

async function registrarLog(sessaoId: string, evento: WhatsAppSessaoEvento, detalhe?: string) {
  await prisma.whatsAppSessaoLog.create({ data: { sessaoId, evento, detalhe } });
}

async function atualizarStatus(sessaoId: string, novoStatus: WhatsAppSessaoStatus, opts?: { erro?: string }) {
  const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
  if (!transicaoValida(sessao.status, novoStatus)) {
    throw new Error(`Transição inválida: ${sessao.status} → ${novoStatus}`);
  }
  await prisma.whatsAppSessao.update({
    where: { id: sessaoId },
    data: {
      status: novoStatus,
      ...(opts?.erro ? { lastError: opts.erro, lastErrorAt: new Date() } : {}),
    },
  });
}

// Lock leve por sessão: evita duas operações de lifecycle concorrentes na
// mesma sessão (ex: restart e disconnect chegando quase juntos). Usa
// RECONNECTING como marcador transitório de "operação em andamento" — não há
// um estado dedicado só pra isso no enum, e semanticamente é o mais próximo.
// Ver "Lock leve por sessão" no documento de arquitetura.
async function adquirirLock(sessaoId: string): Promise<boolean> {
  const resultado = await prisma.whatsAppSessao.updateMany({
    where: { id: sessaoId, status: { not: "RECONNECTING" } },
    data: { status: "RECONNECTING" },
  });
  return resultado.count > 0;
}

export const SessionManager = {
  calcularHealthStatus,

  async criar(nome: string, atendenteId?: string | null): Promise<WhatsAppSessao> {
    const provider = getProvider("EVOLUTION");
    const { providerSessionId, providerVersion } = await provider.createSession(nome);
    const sessao = await prisma.whatsAppSessao.create({
      data: {
        nome,
        provider: "EVOLUTION",
        providerVersion,
        providerSessionId,
        status: "WAITING_QR",
        atendenteId: atendenteId ?? null,
      },
    });
    await registrarLog(sessao.id, "QR_GERADO");
    return sessao;
  },

  async obterQrCode(sessaoId: string): Promise<{ qrCode: string | null; status: WhatsAppSessaoStatus }> {
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    const provider = getProvider(sessao.provider);
    return provider.getQrCode(sessao.providerSessionId);
  },

  async desconectar(sessaoId: string): Promise<void> {
    const bloqueado = !(await adquirirLock(sessaoId));
    if (bloqueado) throw new Error("Já existe uma operação em andamento nesta sessão");
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    try {
      const provider = getProvider(sessao.provider);
      await provider.disconnect(sessao.providerSessionId);
      await atualizarStatus(sessaoId, "OFFLINE");
      await registrarLog(sessaoId, "DESCONECTOU");
    } catch (err) {
      await atualizarStatus(sessaoId, "ERROR", { erro: err instanceof Error ? err.message : "Erro ao desconectar" });
      await registrarLog(sessaoId, "ERRO", err instanceof Error ? err.message : undefined);
      throw err;
    }
  },

  async reiniciar(sessaoId: string): Promise<void> {
    const bloqueado = !(await adquirirLock(sessaoId));
    if (bloqueado) throw new Error("Já existe uma operação em andamento nesta sessão");
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    try {
      const provider = getProvider(sessao.provider);
      await provider.restart(sessao.providerSessionId);
      await registrarLog(sessaoId, "REINICIOU");
    } catch (err) {
      await atualizarStatus(sessaoId, "ERROR", { erro: err instanceof Error ? err.message : "Erro ao reiniciar" });
      await registrarLog(sessaoId, "ERRO", err instanceof Error ? err.message : undefined);
      throw err;
    }
  },

  // Soft-delete — nunca remove a linha da sessão (e portanto nunca aciona o
  // Restrict em WhatsAppConversa.sessao). Ver decisão arquitetural no doc.
  async excluir(sessaoId: string): Promise<void> {
    const sessao = await prisma.whatsAppSessao.findUniqueOrThrow({ where: { id: sessaoId } });
    const provider = getProvider(sessao.provider);
    try {
      await provider.deleteSession(sessao.providerSessionId);
    } catch (err) {
      // Mesmo se o gateway falhar em remover do lado dele, o CRM ainda marca
      // como inativo — a sessão para de aparecer/ser usável no CRM.
      await registrarLog(sessaoId, "ERRO", err instanceof Error ? err.message : "Erro ao excluir no gateway");
    }
    await prisma.whatsAppSessao.update({ where: { id: sessaoId }, data: { ativo: false, status: "OFFLINE" } });
    await registrarLog(sessaoId, "ATUALIZOU", "Sessão desativada (soft-delete)");
  },

  async reatribuirAtendente(sessaoId: string, atendenteId: string | null): Promise<WhatsAppSessao> {
    const sessao = await prisma.whatsAppSessao.update({ where: { id: sessaoId }, data: { atendenteId } });
    await registrarLog(sessaoId, "ATUALIZOU", `Atendente reatribuído`);
    return sessao;
  },

  atualizarStatus,
  registrarLog,
};
