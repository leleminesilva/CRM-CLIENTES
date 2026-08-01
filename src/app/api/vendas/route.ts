import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, buildWhereClause } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Todos os pedidos confirmados (vendas), pra alimentar o Kanban da aba
// "Confirmado" — controle de pós-venda (vidro, agendamento, observações).
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:read");

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...buildWhereClause(payload.role, payload.userId),
    };

    const vendas = await prisma.venda.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true, nome: true, telefone: true, whatsapp: true,
            cep: true, logradouro: true, numero: true, bairro: true, cidade: true, estado: true,
          },
        },
        responsavel: { select: { id: true, nome: true, avatar: true } },
      },
      orderBy: [{ statusPosVenda: "asc" }, { ordemKanban: "asc" }, { data: "desc" }],
    });

    return NextResponse.json({ data: vendas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar vendas" }, { status: 500 });
  }
}
