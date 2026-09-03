import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeWhatsAppPhone, normalizePhone } from "@/lib/utils/phone";
import { getProvider } from "@/lib/whatsapp/providers";
import { emit } from "@/lib/whatsapp/events";
import { registrarHandlersWhatsApp } from "@/lib/whatsapp/handlers";
import { waLogger } from "@/lib/whatsapp/logger";
import { publicarSessao } from "@/lib/whatsapp/realtime";
import { uploadMedia, caminhoMedia } from "@/lib/whatsapp/media";
import { WHATSAPP_STANDBY } from "@/lib/rbac";
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
  // Módulo em standby (ver src/lib/rbac.ts): não processa nem grava nada,
  // só responde 200 pro gateway não ficar reentregando o evento.
  if (WHATSAPP_STANDBY) return NextResponse.json({ ok: true });

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
      const fromMe = !!msg.fromMe;
      // Ignora eventos de grupo/sistema sem conteúdo útil (reações, protocol
      // messages, distribuição de chave, etc.) — eles poluem a conversa com
      // balões vazios, ainda mais em grupo.
      if (msg.tipo === "texto" && !(msg.conteudo ?? "").trim() && !msg.media) continue;
      // Grupo mantém o id do grupo como "telefone" (não passa pelo ajuste do
      // 9º dígito, que só vale pra celular BR).
      const fromPhone = msg.isGrupo ? normalizePhone(msg.fromPhone) : normalizeWhatsAppPhone(msg.fromPhone);

      // A sessão que recebeu essa mensagem — o webhook da Evolution não traz
      // o nome da instância diretamente no evento normalizado de mensagem
      // hoje; resolvido via o campo "instance" do payload bruto.
      const instanceName = (body as { instance?: string }).instance;
      const sessao = instanceName
        ? await prisma.whatsAppSessao.findUnique({ where: { providerSessionId: instanceName } })
        : null;
      if (!sessao) continue;

      // fromMe = mensagem enviada pelo próprio número. Se já existe uma
      // mensagem com esse providerMessageId, foi o CRM que enviou (já
      // persistida no envio) — descarta o eco. Se não existe, foi enviada
      // pelo celular do WhatsApp; a gravamos como "saida" pra aparecer aqui.
      if (fromMe) {
        const jaExiste = await prisma.whatsAppMensagem.findUnique({
          where: { providerMessageId: msg.providerMessageId },
          select: { id: true },
        });
        if (jaExiste) continue;
      }

      const conversa = await prisma.whatsAppConversa.upsert({
        where: { sessaoId_contatoPhone: { sessaoId: sessao.id, contatoPhone: fromPhone } },
        create: {
          sessaoId: sessao.id,
          contatoPhone: fromPhone,
          contatoNome: msg.contatoNome,
          isGrupo: msg.isGrupo ?? false,
          ultimaMsgEm: msg.timestamp,
          naoLidas: fromMe ? 0 : 1,
        },
        update: {
          // Em grupo, msg.contatoNome só vem preenchido quando o gateway
          // manda o assunto do grupo — nunca sobrescreve com nome de pessoa.
          contatoNome: msg.contatoNome ?? undefined,
          isGrupo: msg.isGrupo ? true : undefined,
          ultimaMsgEm: msg.timestamp,
          // Respondeu pelo celular → zera não lidas; mensagem recebida → +1.
          naoLidas: fromMe ? 0 : { increment: 1 },
        },
      });

      // Nome do grupo: se ainda não tem, tenta puxar o assunto do gateway.
      if (msg.isGrupo && !conversa.contatoNome && provider.infoGrupo) {
        try {
          const info = await provider.infoGrupo(instanceName!, `${fromPhone}@g.us`);
          if (info?.subject) {
            await prisma.whatsAppConversa.update({
              where: { id: conversa.id },
              data: { contatoNome: info.subject },
            });
          }
        } catch (err) {
          waLogger.error("falha ao buscar nome do grupo", { erro: err, conversationId: conversa.id });
        }
      }

      await prisma.whatsAppSessao.update({
        where: { id: sessao.id },
        data: { ultimaMensagemRecebida: msg.timestamp },
      });

      // Mídia: o webhook da Evolution não traz o conteúdo por padrão. Se veio
      // com base64, usa; senão, rebusca no gateway pela key da mensagem. Sobe
      // pro Storage privado guardando só o caminho, nunca uma URL pública.
      let mediaPath: string | undefined;
      if (msg.media) {
        let base64 = msg.media.base64;
        let mimeType = msg.media.mimeType;
        let filename = msg.media.filename;
        if (!base64 && msg.providerMessageKey && provider.baixarMedia) {
          const baixado = await provider.baixarMedia(instanceName!, msg.providerMessageKey);
          if (baixado) {
            base64 = baixado.base64;
            mimeType = baixado.mimeType || mimeType;
            filename = baixado.filename ?? filename;
          }
        }
        if (base64) {
          try {
            const caminho = caminhoMedia(sessao.id, conversa.id, mimeType, filename);
            await uploadMedia(caminho, Buffer.from(base64, "base64"), mimeType);
            mediaPath = caminho;
          } catch (err) {
            waLogger.error("falha ao subir mídia recebida", { erro: err, sessionId: sessao.id, conversationId: conversa.id });
          }
        }
      }

      try {
        await prisma.whatsAppMensagem.create({
          data: {
            conversaId: conversa.id,
            providerMessageId: msg.providerMessageId,
            direcao: fromMe ? "saida" : "entrada",
            tipo: msg.tipo,
            conteudo: msg.conteudo ?? "",
            remetenteNome: msg.remetenteNome ?? null,
            remetentePhone: msg.remetentePhone ?? null,
            mediaUrl: mediaPath,
            enviadaEm: msg.timestamp,
            // Recebida = ENTREGUE (o enum de status modela o ciclo de envio).
            // Enviada pelo celular = LIDA (já saiu do aparelho, sem eco de status).
            status: fromMe ? "LIDA" : "ENTREGUE",
          },
        });
      } catch (err) {
        // Corrida com o envio pelo CRM: mesma mensagem, providerMessageId
        // único já gravado. Ignora e segue.
        waLogger.error("mensagem duplicada ignorada", { erro: err, conversationId: conversa.id });
        continue;
      }

      if (!fromMe) {
        await emit(
          "MessageReceived",
          { conversaId: conversa.id, sessaoId: sessao.id, fromPhone, conteudo: msg.conteudo ?? "" },
          correlationId,
        );
      }
      await emit("ConversationUpdated", { conversaId: conversa.id }, correlationId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    waLogger.error("erro ao processar webhook", { erro: err });
    return NextResponse.json({ ok: true }); // sempre responde 200 pro gateway
  }
}
