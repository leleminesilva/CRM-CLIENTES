import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Conversa privada entre o usuário logado e outro funcionário (params.userId).
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // 200 mensagens mais recentes (desc + take), reordenadas pra exibição (asc).
  const mensagens = await prisma.chatMensagem.findMany({
    where: {
      deletedAt: null,
      OR: [
        { autorId: payload.userId, destinatarioId: params.userId },
        { autorId: params.userId, destinatarioId: payload.userId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { autor: { select: { id: true, nome: true, avatar: true } } },
  });
  mensagens.reverse();

  // Marca como lidas as mensagens que o outro usuário me mandou
  await prisma.chatMensagem.updateMany({
    where: { autorId: params.userId, destinatarioId: payload.userId, lida: false },
    data: { lida: true },
  });

  return NextResponse.json({ data: mensagens });
}

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (params.userId === payload.userId) {
    return NextResponse.json({ error: "Não é possível enviar mensagem pra si mesmo" }, { status: 400 });
  }

  const destinatario = await prisma.user.findFirst({
    where: { id: params.userId, deletedAt: null, ativo: true },
    select: { id: true },
  });
  if (!destinatario) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const { conteudo } = await request.json();
  if (!conteudo?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const mensagem = await prisma.chatMensagem.create({
    data: { conteudo: conteudo.trim(), autorId: payload.userId, destinatarioId: params.userId },
    include: { autor: { select: { id: true, nome: true, avatar: true } } },
  });

  return NextResponse.json({ data: mensagem }, { status: 201 });
}
