import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "./send";
import { emit } from "./events";
import { waLogger } from "./logger";

// Processa os envios agendados que já venceram. Chamado de forma oportunista
// (webhook e polling da lista de conversas) — o projeto não tem cron.
// Ver docs/architecture/whatsapp-crm-integracao.md.

const MAX_POR_RODADA = 20;
const MAX_TENTATIVAS = 6;
const CLAIM_MS = 2 * 60 * 1000; // solta o "processando" travado depois de 2 min

let rodando = false;

export async function processarEnviosAgendados(): Promise<void> {
  if (rodando) return; // evita rodadas concorrentes no mesmo processo
  rodando = true;
  try {
    const agora = new Date();
    const claimAntes = new Date(Date.now() - CLAIM_MS);

    const devidos = await prisma.whatsAppEnvioAgendado.findMany({
      where: {
        enviadoEm: null,
        canceladoEm: null,
        enviarEm: { lte: agora },
        OR: [{ processandoEm: null }, { processandoEm: { lt: claimAntes } }],
      },
      orderBy: { enviarEm: "asc" },
      take: MAX_POR_RODADA,
    });

    for (const envio of devidos) {
      // Claim otimista: só segue quem conseguir marcar processandoEm.
      const claim = await prisma.whatsAppEnvioAgendado.updateMany({
        where: {
          id: envio.id,
          enviadoEm: null,
          canceladoEm: null,
          OR: [{ processandoEm: null }, { processandoEm: { lt: claimAntes } }],
        },
        data: { processandoEm: agora, tentativas: { increment: 1 } },
      });
      if (claim.count === 0) continue;

      try {
        const conversa = await prisma.whatsAppConversa.findUnique({
          where: { id: envio.conversaId },
          include: { sessao: true },
        });
        if (!conversa) {
          await prisma.whatsAppEnvioAgendado.update({
            where: { id: envio.id },
            data: { canceladoEm: agora, motivoCancelamento: "conversa não existe mais" },
          });
          continue;
        }

        // Se o cliente já escreveu nesse meio-tempo, não manda a mensagem
        // automática — cancela.
        const jaFalou = await prisma.whatsAppMensagem.count({
          where: { conversaId: conversa.id, direcao: "entrada" },
        });
        if (jaFalou > 0) {
          await prisma.whatsAppEnvioAgendado.update({
            where: { id: envio.id },
            data: { canceladoEm: agora, motivoCancelamento: "cliente respondeu antes" },
          });
          continue;
        }

        if (conversa.sessao.status !== "ONLINE") {
          if (envio.tentativas >= MAX_TENTATIVAS) {
            await prisma.whatsAppEnvioAgendado.update({
              where: { id: envio.id },
              data: { canceladoEm: agora, motivoCancelamento: "canal ficou offline" },
            });
          } else {
            // libera pra tentar de novo na próxima rodada
            await prisma.whatsAppEnvioAgendado.update({ where: { id: envio.id }, data: { processandoEm: null } });
          }
          continue;
        }

        await sendWhatsAppMessage(conversa, envio.texto);
        await prisma.whatsAppEnvioAgendado.update({
          where: { id: envio.id },
          data: { enviadoEm: new Date(), processandoEm: null },
        });
        await emit("ConversationUpdated", { conversaId: conversa.id }, `envio-${envio.id}`);
      } catch (err) {
        waLogger.error(`falha ao processar envio agendado ${envio.id}`, { erro: err });
        await prisma.whatsAppEnvioAgendado
          .update({
            where: { id: envio.id },
            data:
              envio.tentativas >= MAX_TENTATIVAS
                ? { canceladoEm: new Date(), motivoCancelamento: "erro repetido no envio", processandoEm: null }
                : { processandoEm: null },
          })
          .catch(() => {});
      }
    }
  } finally {
    rodando = false;
  }
}
