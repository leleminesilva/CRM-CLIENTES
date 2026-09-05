import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getProvider } from "@/lib/whatsapp/providers";
import { emit } from "@/lib/whatsapp/events";
import { registrarHandlersWhatsApp } from "@/lib/whatsapp/handlers";
import { waLogger } from "@/lib/whatsapp/logger";
import { publicarSessao } from "@/lib/whatsapp/realtime";
import { ingerirMensagem } from "@/lib/whatsapp/ingest";
import { processarEnviosAgendados } from "@/lib/whatsapp/envios-agendados";
import { WHATSAPP_STANDBY } from "@/lib/rbac";
import type { WhatsAppSessaoEvento, WhatsAppSessaoStatus } from "@prisma/client";

export const maxDuration = 60;

// Registra os handlers uma vez por cold start — ver src/lib/whatsapp/handlers.ts.
registrarHandlersWhatsApp();

function eventoDoStatus(status: WhatsAppSessaoStatus, temQrCode: boolean): WhatsAppSessaoEvento {
  if (temQrCode) return "QR_GERADO";
  if (status === "ONLINE") return "CONECTOU";
  if (status === "OFFLINE") return "DESCONECTOU";
  if (status === "RECONNECTING") return "RECONECTOU";
  if (status === "ERROR") return "ERRO";
  return "ATUALIZOU";
}

export const dynamic = "force-dynamic";

// Recebe webhooks do gateway (Evolution API). Verificação de assinatura é
// feita via EVOLUTION_API_KEY na URL/header configurado no gateway (não há
// handshake tipo hub.challenge da Meta aqui). Idempotência, confirmações de
// entrega/leitura e os handlers do pipeline de eventos (ver
// src/lib/whatsapp/handlers.ts) já implementados. Ver docs/architecture/whatsapp.md.
export async function POST(request: NextRequest) {
  // Módulo em standby (ver src/lib/rbac.ts): não processa nem grava nada,
  // só responde 200 pro gateway não ficar reentregando o evento.
  if (WHATSAPP_STANDBY) return NextResponse.json({ ok: true });

  // Sem cron no projeto: aproveita o tráfego do webhook pra processar os
  // envios agendados (ex: boas-vindas com atraso) que já venceram.
  void processarEnviosAgendados().catch(() => {});

  try {
    const body = await request.json();
    const provider = getProvider("EVOLUTION");
    const eventos = provider.parseWebhook(body);

    for (const evento of eventos) {
      // Idempotência: gateways reentregam webhook. Descarta duplicata sem
      // reprocessar nada (mas ainda responde 200 no final, pro gateway não
      // ficar reentregando pra sempre).
      try {
        await prisma.whatsAppWebhookEvent.create({
          data: { providerEventId: evento.providerEventId, tipo: evento.type },
        });
      } catch {
        continue; // violação de unicidade = entrega duplicada
      }

      const correlationId = evento.providerEventId;

      if (evento.type === "session") {
        const sessao = await prisma.whatsAppSessao.findUnique({
          where: { providerSessionId: evento.data.providerSessionId },
        });
        if (!sessao) continue;

        await prisma.whatsAppSessao.update({
          where: { id: sessao.id },
          data: { status: evento.data.status, ultimoPing: new Date() },
        });
        await prisma.whatsAppSessaoLog.create({
          data: { sessaoId: sessao.id, evento: eventoDoStatus(evento.data.status, !!evento.data.qrCode) },
        });
        // Broadcast efêmero — o QR nunca é persistido, só repassado ao vivo.
        await publicarSessao(sessao.id, { status: evento.data.status, qrCode: evento.data.qrCode ?? null });

        // Conectou pela primeira vez → dispara a importação do histórico
        // (fire-and-forget: roda numa invocação própria, com orçamento de
        // tempo próprio; ela se re-chama até terminar). Ver
        // src/app/api/whatsapp/sessoes/[id]/importar-historico.
        if (evento.data.status === "ONLINE" && !sessao.historicoImportadoEm) {
          try {
            const origin = new URL(request.url).origin;
            void fetch(`${origin}/api/whatsapp/sessoes/${sessao.id}/importar-historico`, {
              method: "POST",
              headers: { "x-wa-internal": process.env.EVOLUTION_API_KEY ?? "" },
            }).catch(() => {});
          } catch {
            /* noop */
          }
        }
        continue;
      }

      if (evento.type === "receipt") {
        const campo =
          evento.data.status === "entregue" ? "entregueEm" : evento.data.status === "lida" ? "lidaEm" : "falhouEm";
        await prisma.whatsAppMensagem.updateMany({
          where: { providerMessageId: evento.data.providerMessageId },
          data: {
            status: evento.data.status === "entregue" ? "ENTREGUE" : evento.data.status === "lida" ? "LIDA" : "FALHOU",
            [campo]: evento.data.timestamp,
          },
        });
        continue;
      }

      // evento.type === "message"
      const msg = evento.data;

      // A sessão que recebeu essa mensagem — resolvida via o campo "instance"
      // do payload bruto (o evento normalizado não traz a instância).
      const instanceName = (body as { instance?: string }).instance;
      const sessao = instanceName
        ? await prisma.whatsAppSessao.findUnique({ where: { providerSessionId: instanceName } })
        : null;
      if (!sessao) continue;

      const res = await ingerirMensagem(sessao.id, msg, provider, instanceName!, {
        contaNaoLidas: true,
        baixarMidia: true,
      });
      if (!res) continue; // duplicata, evento vazio, ou eco de envio pelo CRM

      // Nome do grupo: se ainda não tem, tenta puxar o assunto do gateway.
      if (res.isGrupo && provider.infoGrupo) {
        const conv = await prisma.whatsAppConversa.findUnique({ where: { id: res.conversaId }, select: { contatoNome: true } });
        if (!conv?.contatoNome) {
          try {
            const info = await provider.infoGrupo(instanceName!, `${res.contatoPhone}@g.us`);
            if (info?.subject) {
              await prisma.whatsAppConversa.update({ where: { id: res.conversaId }, data: { contatoNome: info.subject } });
            }
          } catch (err) {
            waLogger.error("falha ao buscar nome do grupo", { erro: err, conversationId: res.conversaId });
          }
        }
      }

      // Foto de perfil: sincroniza se nunca buscou ou já faz +24h.
      if (provider.fotoPerfil) {
        const conv = await prisma.whatsAppConversa.findUnique({ where: { id: res.conversaId }, select: { fotoSyncEm: true } });
        const velha = !conv?.fotoSyncEm || Date.now() - conv.fotoSyncEm.getTime() > 24 * 3600 * 1000;
        if (velha) {
          try {
            const url = await provider.fotoPerfil(instanceName!, res.isGrupo ? `${res.contatoPhone}@g.us` : res.contatoPhone);
            await prisma.whatsAppConversa.update({ where: { id: res.conversaId }, data: { fotoUrl: url, fotoSyncEm: new Date() } });
          } catch (err) {
            waLogger.error("falha ao buscar foto de perfil", { erro: err, conversationId: res.conversaId });
          }
        }
      }

      await prisma.whatsAppSessao.update({
        where: { id: sessao.id },
        data: { ultimaMensagemRecebida: msg.timestamp },
      });

      if (!res.fromMe) {
        await emit(
          "MessageReceived",
          { conversaId: res.conversaId, sessaoId: sessao.id, fromPhone: res.contatoPhone, conteudo: msg.conteudo ?? "" },
          correlationId,
        );
      }
      await emit("ConversationUpdated", { conversaId: res.conversaId }, correlationId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    waLogger.error("erro ao processar webhook", { erro: err });
    return NextResponse.json({ ok: true }); // sempre responde 200 pro gateway
  }
}
