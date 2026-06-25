import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const user = await prisma.user.findFirst({
      where: { id: payload.userId },
      select: { prefsNotificacao: true },
    });

    const defaults = { leadNovo: true, tarefaVencendo: true, oportunidadeParada: true, clienteSemContato: true };
    const prefs = (user?.prefsNotificacao as object) ?? defaults;
    return NextResponse.json({ data: { ...defaults, ...prefs } });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar preferências" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    await prisma.user.update({
      where: { id: payload.userId },
      data: { prefsNotificacao: body },
    });

    return NextResponse.json({ message: "Preferências salvas" });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar preferências" }, { status: 500 });
  }
}
