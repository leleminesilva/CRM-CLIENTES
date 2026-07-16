import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const { conversaId, mensagem } = body;

  if (!conversaId || !mensagem?.trim()) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const conversa = await prisma.whatsAppConversa.findUnique({
    where: { id: conversaId },
    include: { sessao: true },
  });

  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  try {
    const novaMensagem = await sendWhatsAppMessage(conversa, mensagem);
    return NextResponse.json(novaMensagem, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar mensagem" },
      { status: 502 }
    );
  }
}
