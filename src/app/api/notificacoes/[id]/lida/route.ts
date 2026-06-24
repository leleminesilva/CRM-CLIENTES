import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    await prisma.notificacao.update({
      where: { id: params.id },
      data: { lida: true },
    });

    return NextResponse.json({ message: "Notificação marcada como lida" });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar notificação" }, { status: 500 });
  }
}
