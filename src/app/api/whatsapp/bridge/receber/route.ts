import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Chamado pelo bridge sempre que chega uma mensagem nova (ou histórica, na primeira
// sincronização) no WhatsApp Web conectado. Só grava a conversa/mensagem — sem acionar
// o agente de IA de recepção (isso fica só pra instância oficial da Meta).
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { instanciaId, telefone, nome, conteudo, tipo, direcao, waId, enviadaEm } = await request.json();
  if (!instanciaId || !telefone || !conteudo) {
    return NextResponse.json({ error: "instanciaId, telefone e conteudo obrigatórios" }, { status: 400 });
  }
  const dir = direcao === "saida" ? "saida" : "entrada";
  const quando = enviadaEm ? new Date(enviadaEm) : new Date();

  const conversa = await prisma.whatsAppConversa.upsert({
    where: { instanciaId_contatoPhone: { instanciaId, contatoPhone: telefone } },
    create: {
      instanciaId,
      contatoPhone: telefone,
      contatoNome: nome || undefined,
      ultimaMsgEm: quando,
      naoLidas: dir === "entrada" ? 1 : 0,
    },
    update: {
      contatoNome: nome || undefined,
      // Não retrocede ultimaMsgEm com mensagens antigas chegando fora de ordem (histórico)
      ultimaMsgEm: undefined,
      naoLidas: dir === "entrada" ? { increment: 1 } : undefined,
    },
  });

  // waId identifica a mensagem no WhatsApp — usado pra não duplicar em re-sincronizações
  // de histórico, e pra casar com mensagens que o próprio bridge já enviou via /enviar.
  const mensagem = waId
    ? await prisma.whatsAppMensagem.upsert({
        where: { waId },
        create: {
          conversaId: conversa.id,
          waId,
          direcao: dir,
          tipo: tipo || "texto",
          conteudo,
          status: dir === "entrada" ? "recebida" : "enviada",
          enviadaEm: quando,
        },
        update: {},
      })
    : await prisma.whatsAppMensagem.create({
        data: {
          conversaId: conversa.id,
          direcao: dir,
          tipo: tipo || "texto",
          conteudo,
          status: dir === "entrada" ? "recebida" : "enviada",
          enviadaEm: quando,
        },
      });

  // ultimaMsgEm da conversa deve refletir a mensagem mais recente de fato — como o
  // histórico pode chegar fora de ordem, recalcula em vez de simplesmente sobrescrever.
  if (quando > (conversa.ultimaMsgEm ?? new Date(0))) {
    await prisma.whatsAppConversa.update({ where: { id: conversa.id }, data: { ultimaMsgEm: quando } });
  }

  return NextResponse.json({ ok: true, mensagem });
}
