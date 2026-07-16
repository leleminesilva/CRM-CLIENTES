import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { findClienteByPhone, normalizeWhatsAppPhone } from "@/lib/utils/phone";
import { processarAgenteWhatsApp } from "@/lib/whatsapp/agent";
import { getProvider } from "@/lib/whatsapp/providers";
import { emit } from "@/lib/whatsapp/events";
import { waLogger } from "@/lib/whatsapp/logger";
import { publicarSessao } from "@/lib/whatsapp/realtime";
import type { WhatsAppSessaoEvento, WhatsAppSessaoStatus } from "@prisma/client";

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
// handshake tipo hub.challenge da Meta aqui). Ver docs/architecture/whatsapp.md
// — idempotência (Fase 1) já implementada; parsing completo de mídia e
// confirmações de entrega/leitura, e os handlers do pipeline de eventos
// (ConversationUpdated/LeadUpdated/notificações), são Fase 3.
export async function POST(request: NextRequest) {
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
      const fromPhone = normalizeWhatsAppPhone(msg.fromPhone);

      // A sessão que recebeu essa mensagem — o webhook da Evolution não traz
      // o nome da instância diretamente no evento normalizado de mensagem
      // hoje; resolvido via o campo "instance" do payload bruto.
      const instanceName = (body as { instance?: string }).instance;
      const sessao = instanceName
        ? await prisma.whatsAppSessao.findUnique({ where: { providerSessionId: instanceName } })
        : null;
      if (!sessao) continue;

      const conversa = await prisma.whatsAppConversa.upsert({
        where: { sessaoId_contatoPhone: { sessaoId: sessao.id, contatoPhone: fromPhone } },
        create: {
          sessaoId: sessao.id,
          contatoPhone: fromPhone,
          contatoNome: msg.contatoNome,
          ultimaMsgEm: msg.timestamp,
          naoLidas: 1,
        },
        update: {
          contatoNome: msg.contatoNome ?? undefined,
          ultimaMsgEm: msg.timestamp,
          naoLidas: { increment: 1 },
        },
      });

      await prisma.whatsAppSessao.update({
        where: { id: sessao.id },
        data: { ultimaMensagemRecebida: msg.timestamp },
      });

      await prisma.whatsAppMensagem.create({
        data: {
          conversaId: conversa.id,
          providerMessageId: msg.providerMessageId,
          direcao: "entrada",
          tipo: msg.tipo,
          conteudo: msg.conteudo ?? "",
          enviadaEm: msg.timestamp,
        },
      });

      await emit("MessageReceived", { conversaId: conversa.id, sessaoId: sessao.id }, correlationId);

      if (!conversa.clienteId) {
        const clienteExistente = await findClienteByPhone(fromPhone);
        if (!clienteExistente) {
          const agentEstado = await prisma.whatsAppAgentEstado.findUnique({ where: { conversaId: conversa.id } });
          if (agentEstado?.estado !== "HUMANO" && agentEstado?.estado !== "CONCLUIDO") {
            await processarAgenteWhatsApp({ ...conversa, sessao });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    waLogger.error("erro ao processar webhook", { erro: err });
    return NextResponse.json({ ok: true }); // sempre responde 200 pro gateway
  }
}
