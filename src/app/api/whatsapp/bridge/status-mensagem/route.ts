import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Recibos de entrega/leitura do WhatsApp (messages.update do Baileys), casados pelo waId.
// Silencioso quando a mensagem ainda não existe no CRM (ex: recibo de uma mensagem antiga
// de antes da sincronização de histórico) — não é erro, só não há o que atualizar.
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { waId, status } = await request.json();
  if (!waId || !status) {
    return NextResponse.json({ error: "waId e status obrigatórios" }, { status: 400 });
  }

  try {
    await prisma.whatsAppMensagem.update({ where: { waId }, data: { status } });
  } catch {
    // mensagem não encontrada pelo waId — ignora
  }

  return NextResponse.json({ ok: true });
}
