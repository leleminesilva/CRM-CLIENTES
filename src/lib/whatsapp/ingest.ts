import prisma from "@/lib/prisma";
import { normalizeWhatsAppPhone, normalizePhone } from "@/lib/utils/phone";
import { uploadMedia, caminhoMedia } from "./media";
import { waLogger } from "./logger";
import type { IWhatsAppProvider, NormalizedMessage } from "./providers/types";

// Persistência de uma mensagem recebida — compartilhada pelo webhook ao vivo
// e pela importação de histórico. Faz o upsert da conversa, resolve a mídia
// (opcional) e grava a WhatsAppMensagem, com dedup por providerMessageId.

export interface IngestResult {
  conversaId: string;
  contatoPhone: string;
  isGrupo: boolean;
  fromMe: boolean;
  conversaNova: boolean;
}

export async function ingerirMensagem(
  sessaoId: string,
  msg: NormalizedMessage,
  provider: IWhatsAppProvider,
  providerSessionId: string,
  opts: { contaNaoLidas?: boolean; baixarMidia?: boolean } = {},
): Promise<IngestResult | null> {
  const contaNaoLidas = opts.contaNaoLidas ?? true;
  const baixarMidia = opts.baixarMidia ?? true;
  const fromMe = !!msg.fromMe;

  // Ignora eventos sem conteúdo útil (reações, protocol messages, etc.).
  if (msg.tipo === "texto" && !(msg.conteudo ?? "").trim() && !msg.media) return null;

  const fromPhone = msg.isGrupo ? normalizePhone(msg.fromPhone) : normalizeWhatsAppPhone(msg.fromPhone);
  if (!fromPhone) return null;

  // Dedup: vale pro eco de fromMe e pra reimportar histórico sem duplicar.
  if (msg.providerMessageId) {
    const existe = await prisma.whatsAppMensagem.findUnique({
      where: { providerMessageId: msg.providerMessageId },
      select: { id: true },
    });
    if (existe) return null;
  }

  const antes = await prisma.whatsAppConversa.findUnique({
    where: { sessaoId_contatoPhone: { sessaoId, contatoPhone: fromPhone } },
    select: { id: true, ultimaMsgEm: true },
  });
  const conversaNova = !antes;
  const avancaUltima = !antes?.ultimaMsgEm || msg.timestamp > antes.ultimaMsgEm;

  const conversa = await prisma.whatsAppConversa.upsert({
    where: { sessaoId_contatoPhone: { sessaoId, contatoPhone: fromPhone } },
    create: {
      sessaoId,
      contatoPhone: fromPhone,
      contatoNome: msg.contatoNome,
      isGrupo: msg.isGrupo ?? false,
      ultimaMsgEm: msg.timestamp,
      naoLidas: !fromMe && contaNaoLidas ? 1 : 0,
    },
    update: {
      contatoNome: msg.contatoNome ?? undefined,
      isGrupo: msg.isGrupo ? true : undefined,
      ultimaMsgEm: avancaUltima ? msg.timestamp : undefined,
      naoLidas: fromMe ? 0 : contaNaoLidas ? { increment: 1 } : undefined,
    },
  });

  let mediaPath: string | undefined;
  if (msg.media && baixarMidia) {
    let base64 = msg.media.base64;
    let mimeType = msg.media.mimeType;
    let filename = msg.media.filename;
    if (!base64 && msg.providerMessageKey && provider.baixarMedia) {
      const baixado = await provider.baixarMedia(providerSessionId, msg.providerMessageKey);
      if (baixado) {
        base64 = baixado.base64;
        mimeType = baixado.mimeType || mimeType;
        filename = baixado.filename ?? filename;
      }
    }
    if (base64) {
      try {
        const caminho = caminhoMedia(sessaoId, conversa.id, mimeType, filename);
        await uploadMedia(caminho, Buffer.from(base64, "base64"), mimeType);
        mediaPath = caminho;
      } catch (err) {
        waLogger.error("falha ao subir mídia recebida", { erro: err, sessionId: sessaoId, conversationId: conversa.id });
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
        status: fromMe ? "LIDA" : "ENTREGUE",
      },
    });
  } catch (err) {
    // Corrida (mesma mensagem chegando pelo webhook e pelo envio) — providerMessageId único.
    waLogger.error("mensagem duplicada ignorada", { erro: err, conversationId: conversa.id });
    return null;
  }

  return { conversaId: conversa.id, contatoPhone: fromPhone, isGrupo: !!msg.isGrupo, fromMe, conversaNova };
}
