import prisma from "@/lib/prisma";
import type { WhatsAppConversa, WhatsAppInstancia } from "@prisma/client";

type ConversaComInstancia = WhatsAppConversa & { instancia: WhatsAppInstancia };

/**
 * Sends a WhatsApp text message via the Meta Graph API and persists it as an
 * outbound WhatsAppMensagem. Shared by the authenticated /enviar route and
 * the reception AI agent (which runs inside the webhook, with no user
 * session to call that route through).
 */
export async function sendWhatsAppMessage(
  conversa: ConversaComInstancia,
  mensagem: string
) {
  const { phoneNumberId, accessToken } = conversa.instancia;

  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conversa.contatoPhone,
        type: "text",
        text: { body: mensagem },
      }),
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json();
    console.error("[WA Send]", err);
    throw new Error(err?.error?.message ?? "Erro ao enviar mensagem");
  }

  const metaData = await metaRes.json();
  const waId = metaData?.messages?.[0]?.id as string | undefined;

  const novaMensagem = await prisma.whatsAppMensagem.create({
    data: {
      conversaId: conversa.id,
      waId,
      direcao: "saida",
      tipo: "texto",
      conteudo: mensagem,
      status: "enviada",
    },
  });

  await prisma.whatsAppConversa.update({
    where: { id: conversa.id },
    data: { ultimaMsgEm: new Date() },
  });

  return novaMensagem;
}
