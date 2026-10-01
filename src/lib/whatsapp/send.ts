import prisma from "@/lib/prisma";
import type { WhatsAppConversa, WhatsAppSessao, WhatsAppMensagemStatus } from "@prisma/client";
import { getProvider } from "./providers";

type ConversaComSessao = WhatsAppConversa & { sessao: WhatsAppSessao };

async function persistirEnvio(
  conversa: ConversaComSessao,
  dados: { providerMessageId: string; tipo: string; conteudo: string; mediaUrl?: string }
) {
  const novaMensagem = await prisma.whatsAppMensagem.create({
    data: {
      conversaId: conversa.id,
      providerMessageId: dados.providerMessageId,
      direcao: "saida",
      tipo: dados.tipo,
      conteudo: dados.conteudo,
      mediaUrl: dados.mediaUrl,
      status: "ENVIADA" as WhatsAppMensagemStatus,
    },
  });

  await prisma.whatsAppConversa.update({
    where: { id: conversa.id },
    data: { ultimaMsgEm: new Date() },
  });

  return novaMensagem;
}

/**
 * Envia uma mensagem de texto através do provider da sessão e persiste como
 * WhatsAppMensagem de saída. Compartilhado pela rota autenticada /enviar e
 * pelo agente de triagem (que roda dentro do webhook, sem sessão de usuário
 * pra chamar essa rota) — assinatura não muda pra não afetar agent.ts.
 */
export async function sendWhatsAppMessage(conversa: ConversaComSessao, mensagem: string) {
  const provider = getProvider(conversa.sessao.provider);
  const { providerMessageId } = await provider.sendMessage(conversa.sessao.providerSessionId, conversa.contatoPhone, {
    tipo: "texto",
    conteudo: mensagem,
  });

  return persistirEnvio(conversa, { providerMessageId, tipo: "texto", conteudo: mensagem });
}

/**
 * Envia um anexo (imagem/vídeo/áudio/documento) mandando o conteúdo em base64
 * direto pro gateway. O arquivo NÃO é guardado no Storage (a cota do plano
 * Free do Supabase estourou em set/2026): no CRM fica só o registro de que
 * foi enviado um anexo. Documento sem legenda guarda o nome do arquivo.
 */
export async function sendWhatsAppMedia(
  conversa: ConversaComSessao,
  payload: {
    tipo: "imagem" | "video" | "audio" | "documento";
    base64: string;
    mimeType: string;
    legenda?: string;
    filename?: string;
  }
) {
  const provider = getProvider(conversa.sessao.provider);

  const { providerMessageId } = await provider.sendMessage(conversa.sessao.providerSessionId, conversa.contatoPhone, {
    tipo: payload.tipo,
    media: { base64: payload.base64, mimeType: payload.mimeType, filename: payload.filename },
    legenda: payload.legenda,
  });

  return persistirEnvio(conversa, {
    providerMessageId,
    tipo: payload.tipo,
    conteudo: payload.legenda || (payload.tipo === "documento" ? payload.filename ?? "" : ""),
  });
}
