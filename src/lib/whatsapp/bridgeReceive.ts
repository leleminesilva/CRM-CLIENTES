import prisma from "@/lib/prisma";
import { findClienteByPhone } from "@/lib/utils/phone";

export interface MensagemRecebidaInput {
  instanciaId: string;
  telefone: string;
  nome?: string;
  conteudo: string;
  tipo?: string;
  direcao?: string;
  waId?: string;
  enviadaEm?: string;
  mediaUrl?: string;
}

// Compartilhado por /bridge/receber (texto) e /bridge/receber-midia (imagem/áudio/vídeo/
// documento): faz upsert da conversa (vinculando a um Cliente já cadastrado pelo telefone,
// quando existir) e grava a mensagem, evitando duplicar por waId em re-sincronizações de
// histórico ou quando um envio feito pelo próprio bridge ecoa de volta.
export async function registrarMensagemRecebida(input: MensagemRecebidaInput) {
  const { instanciaId, telefone, nome, conteudo, tipo, waId, enviadaEm, mediaUrl } = input;
  const dir = input.direcao === "saida" ? "saida" : "entrada";
  const quando = enviadaEm ? new Date(enviadaEm) : new Date();

  const conversaExistente = await prisma.whatsAppConversa.findUnique({
    where: { instanciaId_contatoPhone: { instanciaId, contatoPhone: telefone } },
  });

  const clienteId =
    conversaExistente?.clienteId ?? (await findClienteByPhone(telefone))?.id ?? undefined;

  const conversa = await prisma.whatsAppConversa.upsert({
    where: { instanciaId_contatoPhone: { instanciaId, contatoPhone: telefone } },
    create: {
      instanciaId,
      contatoPhone: telefone,
      contatoNome: nome || undefined,
      clienteId,
      ultimaMsgEm: quando,
      naoLidas: dir === "entrada" ? 1 : 0,
    },
    update: {
      contatoNome: nome || undefined,
      clienteId,
      // Não retrocede ultimaMsgEm com mensagens antigas chegando fora de ordem (histórico)
      ultimaMsgEm: undefined,
      naoLidas: dir === "entrada" ? { increment: 1 } : undefined,
    },
  });

  const dadosMensagem = {
    conversaId: conversa.id,
    direcao: dir,
    tipo: tipo || "texto",
    conteudo,
    mediaUrl: mediaUrl || undefined,
    status: dir === "entrada" ? "recebida" : "enviada",
    enviadaEm: quando,
  };

  // waId identifica a mensagem no WhatsApp — usado pra não duplicar em re-sincronizações
  // de histórico, e pra casar com mensagens que o próprio bridge já enviou via /enviar.
  const mensagem = waId
    ? await prisma.whatsAppMensagem.upsert({
        where: { waId },
        create: { ...dadosMensagem, waId },
        update: {},
      })
    : await prisma.whatsAppMensagem.create({ data: dadosMensagem });

  // ultimaMsgEm da conversa deve refletir a mensagem mais recente de fato — como o
  // histórico pode chegar fora de ordem, recalcula em vez de simplesmente sobrescrever.
  if (quando > (conversa.ultimaMsgEm ?? new Date(0))) {
    await prisma.whatsAppConversa.update({ where: { id: conversa.id }, data: { ultimaMsgEm: quando } });
  }

  return mensagem;
}
