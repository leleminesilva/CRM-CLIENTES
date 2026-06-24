import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Endpoint público para qualquer usuário autenticado buscar a lista de funcionários ativos
// Usado em selects de "Vendedor Responsável" nos formulários
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const users = await prisma.user.findMany({
      where: { ativo: true, deletedAt: null },
      select: { id: true, nome: true, email: true, role: true },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({ data: users });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }
}
