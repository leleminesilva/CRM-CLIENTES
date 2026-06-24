import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const notificacoes = await prisma.notificacao.findMany({
      where: { userId: payload.userId },
      orderBy: [{ lida: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    const naoLidas = notificacoes.filter((n) => !n.lida).length;
    return NextResponse.json({ data: notificacoes, naoLidas });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar notificações" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    await prisma.notificacao.updateMany({
      where: { userId: payload.userId, lida: false },
      data: { lida: true },
    });

    return NextResponse.json({ message: "Todas marcadas como lidas" });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar notificações" }, { status: 500 });
  }
}
