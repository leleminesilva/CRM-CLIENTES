import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const cliente = await prisma.cliente.update({
      where: { id: params.id, deletedAt: null },
      data: { revisadoEm: new Date() },
    });

    await prisma.atividade.create({
      data: {
        tipo: "EDICAO",
        descricao: "Cliente marcado como Em Processo",
        userId: payload.userId,
        clienteId: params.id,
      },
    });

    return NextResponse.json({ data: cliente });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao revisar cliente" }, { status: 500 });
  }
}
