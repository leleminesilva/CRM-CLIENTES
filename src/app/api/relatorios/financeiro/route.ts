import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "relatorios:view");

    const { searchParams } = new URL(request.url);
    const de = searchParams.get("de") ? new Date(searchParams.get("de")!) : new Date(new Date().setMonth(new Date().getMonth() - 6));
    const ate = searchParams.get("ate") ? new Date(searchParams.get("ate")!) : new Date();

    const [receitaPrevista, receitaFechada, porStatus] = await Promise.all([
      prisma.oportunidade.aggregate({
        where: { deletedAt: null, status: "ABERTA" },
        _sum: { valor: true },
      }),
      prisma.oportunidade.aggregate({
        where: { deletedAt: null, status: "GANHA", dataFechamento: { gte: de, lte: ate } },
        _sum: { valor: true },
        _count: true,
        _avg: { valor: true },
      }),
      prisma.oportunidade.groupBy({
        by: ["status"],
        where: { deletedAt: null, createdAt: { gte: de, lte: ate } },
        _count: true,
        _sum: { valor: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        receitaPrevista: Number(receitaPrevista._sum?.valor || 0),
        receitaFechada: Number(receitaFechada._sum?.valor || 0),
        totalVendas: receitaFechada._count,
        ticketMedio: Number(receitaFechada._avg?.valor || 0),
        porStatus: porStatus.map((p) => ({
          status: p.status,
          total: p._count,
          valor: Number(p._sum?.valor || 0),
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar relatório financeiro" }, { status: 500 });
  }
}
