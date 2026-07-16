import prisma from "@/lib/prisma";
import type { WhatsAppConversa, WhatsAppSessao } from "@prisma/client";
import { getProvider } from "./providers";

type ConversaComSessao = WhatsAppConversa & { sessao: WhatsAppSessao };

/**
 * Envia uma mensagem de texto através do provider da sessão e persiste como
 * WhatsAppMensagem de saída. Compartilhado pela rota autenticada /enviar e
 * pelo agente de triagem (que roda dentro do webhook, sem sessão de usuário
 * pra chamar essa rota).
 */
export async function sendWhatsAppMessage(conversa: ConversaComSessao, mensagem: string) {
  const provider = getProvider(conversa.sessao.provider);
  const { providerMessageId } = await provider.sendMessage(conversa.sessao.providerSessionId, conversa.contatoPhone, {
    tipo: "texto",
    conteudo: mensagem,
  });

  const novaMensagem = await prisma.whatsAppMensagem.create({
    data: {
      conversaId: conversa.id,
      providerMessageId,
      direcao: "saida",
      tipo: "texto",
      conteudo: mensagem,
      status: "ENVIADA",
    },
  });

  await prisma.whatsAppConversa.update({
    where: { id: conversa.id },
    data: { ultimaMsgEm: new Date() },
  });

  return novaMensagem;
}
