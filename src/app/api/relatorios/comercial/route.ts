import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "relatorios:view");

    const { searchParams } = new URL(request.url);
    const de = new Date(searchParams.get("de") || new Date(new Date().setDate(1)).toISOString().split("T")[0]);
    const ate = new Date(searchParams.get("ate") || new Date().toISOString().split("T")[0]);
    ate.setHours(23, 59, 59, 999);

    const [
      leadsGerados,
      leadsConvertidos,
      leadsPerdidos,
      leadsAtivos,
      leadsPorOrigem,
      leadsPorEstagio,
      vendas,
    ] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: de, lte: ate } } }),
      prisma.lead.count({ where: { deletedAt: null, estagio: "FECHADO_GANHO", dataFechamento: { gte: de, lte: ate } } }),
      prisma.lead.count({ where: { deletedAt: null, estagio: "FECHADO_PERDIDO", dataFechamento: { gte: de, lte: ate } } }),
      prisma.lead.count({ where: { deletedAt: null, estagio: { notIn: ["FECHADO_GANHO", "FECHADO_PERDIDO"] } } }),
      prisma.lead.groupBy({
        by: ["origem"],
        where: { deletedAt: null, createdAt: { gte: de, lte: ate } },
        _count: { _all: true },
        orderBy: { _count: { origem: "desc" } },
      }),
      prisma.lead.groupBy({
        by: ["estagio"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ total: number; receita: number }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS total,
            COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS receita
          FROM leads l
          LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
          WHERE l."deletedAt" IS NULL
            AND l.estagio = 'FECHADO_GANHO'::"EstagioLead"
            AND l."dataFechamento" >= ${de}
            AND l."dataFechamento" <= ${ate}
        `
      ),
    ]);

    const vendasFechadas = Number(vendas[0]?.total || 0);
    const receitaFechada = Number(vendas[0]?.receita || 0);

    return NextResponse.json({
      data: {
        leadsGerados,
        leadsConvertidos,
        leadsPerdidos,
        leadsAtivos,
        vendasFechadas,
        receitaFechada,
        ticketMedio: vendasFechadas > 0 ? receitaFechada / vendasFechadas : 0,
        taxaConversaoLeads: leadsGerados > 0 ? Math.round((leadsConvertidos / leadsGerados) * 100) : 0,
        oportunidadesAbertas: leadsAtivos,
        oportunidadesPerdidas: leadsPerdidos,
        leadsPorOrigem: leadsPorOrigem.map((l) => ({ origem: l.origem, total: l._count._all })),
        leadsPorEstagio: leadsPorEstagio.map((l) => ({ estagio: l.estagio, total: l._count._all })),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
  }
}
