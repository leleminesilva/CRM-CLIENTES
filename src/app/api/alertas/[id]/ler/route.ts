import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const alertaId = params.id;

    // Verificar se o alerta existe
    const alerta = await prisma.alerta.findUnique({
      where: { id: alertaId },
    });

    if (!alerta) {
      return NextResponse.json({ error: "Alerta não encontrado" }, { status: 404 });
    }

    // Criar o registro de leitura se não existir
    const leitura = await prisma.alertaLeitura.upsert({
      where: {
        alertaId_userId: {
          alertaId,
          userId: payload.userId,
        },
      },
      update: {},
      create: {
        alertaId,
        userId: payload.userId,
      },
    });

    return NextResponse.json({ data: leitura });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao marcar alerta como lido" }, { status: 500 });
  }
}
