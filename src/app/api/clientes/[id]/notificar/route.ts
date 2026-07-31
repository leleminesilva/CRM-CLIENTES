import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Enviar notificação ao responsável
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { mensagem } = await request.json();
    if (!mensagem?.trim()) return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });

    const cliente = await prisma.cliente.update({
      where: { id: params.id, deletedAt: null },
      data: {
        notificacaoMensagem: mensagem.trim(),
        notificacaoEm: new Date(),
        notificacaoLida: false,
        notificacaoResposta: null,
        notificacaoRespondidaEm: null,
      },
    });

    await prisma.atividade.create({
      data: {
        tipo: "EDICAO",
        descricao: `Notificação enviada ao responsável: ${mensagem.trim()}`,
        userId: payload.userId,
        clienteId: params.id,
      },
    });

    return NextResponse.json({ data: cliente });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao enviar notificação" }, { status: 500 });
  }
}

// Marcar notificação como lida (responsável clicou em entendido) e,
// opcionalmente, registrar a resposta do responsável para quem notificou
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const resposta: string | undefined = body?.resposta?.trim();

    const cliente = await prisma.cliente.update({
      where: { id: params.id, deletedAt: null },
      data: {
        notificacaoLida: true,
        notificacaoEm: null,
        ...(resposta && {
          notificacaoResposta: resposta,
          notificacaoRespondidaEm: new Date(),
        }),
      },
    });

    if (resposta) {
      await prisma.atividade.create({
        data: {
          tipo: "EDICAO",
          descricao: `Respondeu à notificação: ${resposta}`,
          userId: payload.userId,
          clienteId: params.id,
        },
      });
    }

    return NextResponse.json({ data: cliente });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao marcar notificação" }, { status: 500 });
  }
}
