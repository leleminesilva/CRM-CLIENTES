import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const comentario = await prisma.comentario.findFirst({ where: { id: params.id } });
    if (!comentario) return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });

    if (comentario.userId !== payload.userId && payload.role !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    }

    await prisma.comentario.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Comentário removido" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover comentário" }, { status: 500 });
  }
}
