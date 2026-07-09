import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Canal geral: mensagens visíveis pra toda a equipe (destinatarioId null).
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const mensagens = await prisma.chatMensagem.findMany({
    where: { destinatarioId: null, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { autor: { select: { id: true, nome: true, avatar: true } } },
  });

  // Marca como lido até agora — usado só pra calcular o badge de não lidas do canal geral.
  await prisma.chatLeitura.upsert({
    where: { userId: payload.userId },
    create: { userId: payload.userId, ultimaGeral: new Date() },
    update: { ultimaGeral: new Date() },
  });

  return NextResponse.json({ data: mensagens });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { conteudo } = await request.json();
  if (!conteudo?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const mensagem = await prisma.chatMensagem.create({
    data: { conteudo: conteudo.trim(), autorId: payload.userId },
    include: { autor: { select: { id: true, nome: true, avatar: true } } },
  });

  await prisma.chatLeitura.upsert({
    where: { userId: payload.userId },
    create: { userId: payload.userId, ultimaGeral: new Date() },
    update: { ultimaGeral: new Date() },
  });

  return NextResponse.json({ data: mensagem }, { status: 201 });
}
