import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const clientes = await prisma.cliente.findMany({
      where: {
        responsavelId: payload.userId,
        notificacaoLida: false,
        notificacaoMensagem: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        nome: true,
        notificacaoMensagem: true,
        notificacaoEm: true,
      },
      orderBy: { notificacaoEm: "desc" },
    });

    return NextResponse.json({ data: clientes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar notificações" }, { status: 500 });
  }
}
