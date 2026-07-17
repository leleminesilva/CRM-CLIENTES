import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeWhatsAppPhone } from "@/lib/utils/phone";
import { getProvider } from "@/lib/whatsapp/providers";
import { emit } from "@/lib/whatsapp/events";
import { registrarHandlersWhatsApp } from "@/lib/whatsapp/handlers";
import { waLogger } from "@/lib/whatsapp/logger";
import { publicarSessao } from "@/lib/whatsapp/realtime";
import { uploadMedia, caminhoMedia } from "@/lib/whatsapp/media";
import type { WhatsAppSessaoEvento, WhatsAppSessaoStatus } from "@prisma/client";

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

      // Mídia recebida (se o gateway entregou o conteúdo — ver comentário em
      // extrairConteudoMensagem no EvolutionProvider) sobe pro Storage antes
      // de gravar a mensagem, guardando só o caminho, nunca uma URL pública.
      let mediaPath: string | undefined;
      if (msg.media?.base64) {
        try {
          const caminho = caminhoMedia(sessao.id, conversa.id, msg.media.mimeType, msg.media.filename);
          await uploadMedia(caminho, Buffer.from(msg.media.base64, "base64"), msg.media.mimeType);
          mediaPath = caminho;
        } catch (err) {
          waLogger.error("falha ao subir mídia recebida", { erro: err, sessionId: sessao.id, conversationId: conversa.id });
        }
      }

      await prisma.whatsAppMensagem.create({
        data: {
          conversaId: conversa.id,
          providerMessageId: msg.providerMessageId,
          direcao: "entrada",
          tipo: msg.tipo,
          conteudo: msg.conteudo ?? "",
          mediaUrl: mediaPath,
          enviadaEm: msg.timestamp,
          // ENTREGUE (não o default ENVIANDO) — o enum de status modela o
          // ciclo de vida de envio, que não se aplica a mensagens recebidas.
          status: "ENTREGUE",
        },
      });

      await emit("MessageReceived", { conversaId: conversa.id, sessaoId: sessao.id, fromPhone }, correlationId);
      await emit("ConversationUpdated", { conversaId: conversa.id }, correlationId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    waLogger.error("erro ao processar webhook", { erro: err });
    return NextResponse.json({ ok: true }); // sempre responde 200 pro gateway
  }
}
