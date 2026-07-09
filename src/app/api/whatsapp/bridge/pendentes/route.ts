import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// O bridge faz polling aqui pra saber quais mensagens foram digitadas no CRM e
// ainda não foram de fato entregues pelo WhatsApp Web (Baileys).
export async function GET(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const instanciaId = request.nextUrl.searchParams.get("instanciaId");
  if (!instanciaId) {
    return NextResponse.json({ error: "instanciaId obrigatório" }, { status: 400 });
  }

  const pendentes = await prisma.whatsAppMensagem.findMany({
    where: {
      status: "pendente",
      direcao: "saida",
      conversa: { instanciaId },
    },
    include: { conversa: { select: { contatoPhone: true } } },
    orderBy: { enviadaEm: "asc" },
    take: 20,
  });

  return NextResponse.json(
    pendentes.map((m) => ({
      mensagemId: m.id,
      telefone: m.conversa.contatoPhone,
      conteudo: m.conteudo,
    }))
  );
}
