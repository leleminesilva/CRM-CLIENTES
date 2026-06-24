import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildWhereClause } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

function getPeriodRange(periodo: string) {
  const now = new Date();
  switch (periodo) {
    case "hoje": return { de: startOfDay(now), ate: endOfDay(now) };
    case "semana": return { de: startOfWeek(now, { weekStartsOn: 1 }), ate: endOfWeek(now, { weekStartsOn: 1 }) };
    case "mes": return { de: startOfMonth(now), ate: endOfMonth(now) };
    case "ano": return { de: startOfYear(now), ate: endOfYear(now) };
    default: return { de: startOfMonth(now), ate: endOfMonth(now) };
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "mes";
    const { de, ate } = getPeriodRange(periodo);
    const userFilter = buildWhereClause(payload.role, payload.userId);

    const [
      totalClientes,
      leadsAtivos,
      funnelData,
      leadsPorOrigem,
      leadsGanhosPeriodo,
      valorNegociacaoAtual,
      receitaFechadaPeriodo,
      leadsTotal,
      leadsConvertidos,
      vendasPorVendedorRaw,
    ] = await Promise.all([
      // Total clientes
      prisma.cliente.count({ where: { deletedAt: null, ...userFilter } }),

      // Leads ativos (não fechados)
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: { notIn: ["FECHADO_GANHO", "FECHADO_PERDIDO"] },
          ...userFilter,
        },
      }),

      // Funil de vendas (leads por estágio — sem filtro de período)
      prisma.lead.groupBy({
        by: ["estagio"],
        where: { deletedAt: null, ...userFilter },
        _count: { _all: true },
        _sum: { valorEstimado: true },
      }),

      // Leads por origem no período
      prisma.lead.groupBy({
        by: ["origem"],
        where: { deletedAt: null, createdAt: { gte: de, lte: ate }, ...userFilter },
        _count: { _all: true },
      }),

      // Leads ganhos (fechados com ganho) no período
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: "FECHADO_GANHO",
          dataFechamento: { gte: de, lte: ate },
          ...userFilter,
        },
      }),

      // Valor em negociação (soma do valorEstimado dos leads ativos)
      prisma.lead.aggregate({
        where: {
          deletedAt: null,
          estagio: { notIn: ["FECHADO_GANHO", "FECHADO_PERDIDO"] },
          valorEstimado: { not: null },
          ...userFilter,
        },
        _sum: { valorEstimado: true },
      }),

      // Receita fechada no período (soma do valorEstimado dos leads FECHADO_GANHO)
      prisma.lead.aggregate({
        where: {
          deletedAt: null,
          estagio: "FECHADO_GANHO",
          dataFechamento: { gte: de, lte: ate },
          ...userFilter,
        },
        _sum: { valorEstimado: true },
        _count: { _all: true },
      }),

      // Total de leads criados no período (para taxa de conversão)
      prisma.lead.count({
        where: { deletedAt: null, createdAt: { gte: de, lte: ate }, ...userFilter },
      }),

      // Leads convertidos no período
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: "FECHADO_GANHO",
          dataFechamento: { gte: de, lte: ate },
          ...userFilter,
        },
      }),

      // Vendas por vendedor no período (top 5 por receita) — com filtro de usuário
      prisma.lead.groupBy({
        by: ["responsavelId"],
        where: {
          deletedAt: null,
          estagio: "FECHADO_GANHO",
          dataFechamento: { gte: de, lte: ate },
          ...buildWhereClause(payload.role, payload.userId),
        },
        _count: { _all: true },
        _sum: { valorEstimado: true },
        orderBy: { _sum: { valorEstimado: "desc" } },
        take: 5,
      }),
    ]);

    const receitaFechada = Number(receitaFechadaPeriodo._sum?.valorEstimado || 0);
    const vendasFechadas = receitaFechadaPeriodo._count?._all || 0;
    const ticketMedio = vendasFechadas > 0 ? receitaFechada / vendasFechadas : 0;
    const taxaConversao = leadsTotal > 0 ? (leadsConvertidos / leadsTotal) * 100 : 0;

    const funnelFormatted = funnelData.map((f) => ({
      estagio: f.estagio,
      total: f._count._all,
      valor: Number(f._sum?.valorEstimado || 0),
    }));

    // Nomes dos vendedores para o gráfico
    const vendedorIds = vendasPorVendedorRaw.map((v) => v.responsavelId).filter(Boolean) as string[];
    const vendedores = await prisma.user.findMany({
      where: { id: { in: vendedorIds } },
      select: { id: true, nome: true },
    });

    const vendasPorVendedor = vendasPorVendedorRaw.map((v) => ({
      vendedor: vendedores.find((u) => u.id === v.responsavelId)?.nome || "N/A",
      total: v._count._all,
      valor: Number(v._sum?.valorEstimado || 0),
    }));

    // Vendas por mês (últimos 6 meses) — baseado em leads FECHADO_GANHO, com filtro de usuário
    const canViewAllUsers = payload.role === "ADMINISTRADOR" || payload.role === "GESTOR";
    const userFilterSql = canViewAllUsers
      ? Prisma.empty
      : Prisma.sql`AND "responsavelId" = ${payload.userId}`;

    const vendasMesRaw = await prisma.$queryRaw<Array<{ mes: string; mes_num: number; total: number; valor: number }>>(
      Prisma.sql`
        SELECT
          TO_CHAR("dataFechamento", 'Mon') as mes,
          EXTRACT(MONTH FROM "dataFechamento") as mes_num,
          COUNT(*)::int as total,
          COALESCE(SUM("valorEstimado"), 0)::float as valor
        FROM leads
        WHERE "deletedAt" IS NULL
          AND estagio = 'FECHADO_GANHO'::"EstagioLead"
          AND "dataFechamento" >= NOW() - INTERVAL '6 months'
          ${userFilterSql}
        GROUP BY TO_CHAR("dataFechamento", 'Mon'), EXTRACT(MONTH FROM "dataFechamento")
        ORDER BY mes_num
      `
    );

    return NextResponse.json({
      data: {
        kpis: {
          totalClientes,
          leadsAtivos,
          oportunidadesAbertas: leadsAtivos,
          valorNegociacao: Number(valorNegociacaoAtual._sum?.valorEstimado || 0),
          vendasFechadas,
          taxaConversao: Math.round(taxaConversao * 10) / 10,
          ticketMedio: Math.round(ticketMedio),
          faturamentoPrevisto: receitaFechada,
          leadsGanhos: leadsGanhosPeriodo,
        },
        funil: funnelFormatted,
        vendasMes: vendasMesRaw,
        leadsPorOrigem: leadsPorOrigem.map((l) => ({
          origem: l.origem,
          total: l._count._all,
        })),
        vendasPorVendedor,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao carregar dashboard" }, { status: 500 });
  }
}
