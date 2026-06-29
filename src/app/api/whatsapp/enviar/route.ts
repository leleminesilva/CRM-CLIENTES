import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    include: { instancia: true },
  });

  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const { phoneNumberId, accessToken } = conversa.instancia;

  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conversa.contatoPhone,
        type: "text",
        text: { body: mensagem },
      }),
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json();
    console.error("[WA Send]", err);
    return NextResponse.json(
      { error: err?.error?.message ?? "Erro ao enviar mensagem" },
      { status: 502 }
    );
  }

  const metaData = await metaRes.json();
  const waId = metaData?.messages?.[0]?.id as string | undefined;

  const novaMensagem = await prisma.whatsAppMensagem.create({
    data: {
      conversaId,
      waId,
      direcao: "saida",
      tipo: "texto",
      conteudo: mensagem,
      status: "enviada",
    },
  });

  await prisma.whatsAppConversa.update({
    where: { id: conversaId },
    data: { ultimaMsgEm: new Date() },
  });

  return NextResponse.json(novaMensagem, { status: 201 });
}
