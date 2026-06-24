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
    const de = searchParams.get("de") ? new Date(searchParams.get("de")!) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const ate = searchParams.get("ate") ? new Date(searchParams.get("ate")!) : new Date();

    const [
      leadsGerados,
      leadsConvertidos,
      oportunidadesAbertas,
      oportunidadesGanhas,
      oportunidadesPerdidas,
    ] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: de, lte: ate } } }),
      prisma.lead.count({ where: { deletedAt: null, estagio: "FECHADO_GANHO", dataFechamento: { gte: de, lte: ate } } }),
      prisma.oportunidade.count({ where: { deletedAt: null, status: "ABERTA" } }),
      prisma.oportunidade.aggregate({
        where: { deletedAt: null, status: "GANHA", dataFechamento: { gte: de, lte: ate } },
        _sum: { valor: true },
        _count: true,
        _avg: { valor: true },
      }),
      prisma.oportunidade.count({ where: { deletedAt: null, status: "PERDIDA", dataFechamento: { gte: de, lte: ate } } }),
    ]);

    return NextResponse.json({
      data: {
        leadsGerados,
        leadsConvertidos,
        taxaConversaoLeads: leadsGerados > 0 ? Math.round((leadsConvertidos / leadsGerados) * 100) : 0,
        oportunidadesAbertas,
        vendasFechadas: oportunidadesGanhas._count,
        receitaFechada: Number(oportunidadesGanhas._sum?.valor || 0),
        ticketMedio: Number(oportunidadesGanhas._avg?.valor || 0),
        oportunidadesPerdidas,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
  }
}
