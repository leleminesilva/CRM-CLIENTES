import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null, ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        avatar: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
