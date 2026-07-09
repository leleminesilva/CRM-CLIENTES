import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Chamado pelo bridge sempre que chega uma mensagem nova no WhatsApp Web conectado.
// Só grava a conversa/mensagem — sem acionar o agente de IA de recepção (isso fica
// só para a instância oficial da Meta, que já tem toda a infra de resposta automática).
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { instanciaId, telefone, nome, conteudo, tipo } = await request.json();
  if (!instanciaId || !telefone || !conteudo) {
    return NextResponse.json({ error: "instanciaId, telefone e conteudo obrigatórios" }, { status: 400 });
  }

  const conversa = await prisma.whatsAppConversa.upsert({
    where: { instanciaId_contatoPhone: { instanciaId, contatoPhone: telefone } },
    create: {
      instanciaId,
      contatoPhone: telefone,
      contatoNome: nome || undefined,
      ultimaMsgEm: new Date(),
      naoLidas: 1,
    },
    update: {
      contatoNome: nome || undefined,
      ultimaMsgEm: new Date(),
      naoLidas: { increment: 1 },
    },
  });

  const mensagem = await prisma.whatsAppMensagem.create({
    data: {
      conversaId: conversa.id,
      direcao: "entrada",
      tipo: tipo || "texto",
      conteudo,
      status: "recebida",
    },
  });

  return NextResponse.json({ ok: true, mensagem });
}
