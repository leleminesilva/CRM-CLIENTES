import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Chamado pelo bridge depois de tentar entregar uma mensagem "pendente" via Baileys.
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { mensagemId, sucesso } = await request.json();
  if (!mensagemId) {
    return NextResponse.json({ error: "mensagemId obrigatório" }, { status: 400 });
  }

  const mensagem = await prisma.whatsAppMensagem.update({
    where: { id: mensagemId },
    data: { status: sucesso ? "enviada" : "erro" },
  });

  return NextResponse.json({ ok: true, mensagem });
}
