import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildWhereClause } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const dynamic = "force-dynamic";

function getPeriodRange(periodo: string, mes?: string | null) {
  // Mês específico no formato YYYY-MM
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [year, month] = mes.split("-").map(Number);
    const mesDate = new Date(year, month - 1, 1);
    return { de: startOfMonth(mesDate), ate: endOfMonth(mesDate) };
  }
  const now = new Date();
  switch (periodo) {
    case "hoje":   return { de: startOfDay(now),  ate: endOfDay(now) };
    case "semana": return { de: startOfWeek(now, { weekStartsOn: 1 }), ate: endOfWeek(now, { weekStartsOn: 1 }) };
    case "mes":    return { de: startOfMonth(now), ate: endOfMonth(now) };
    case "ano":    return { de: startOfYear(now),  ate: endOfYear(now) };
    default:       return { de: startOfMonth(now), ate: endOfMonth(now) };
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "mes";
    const mes = searchParams.get("mes");
    const dataInicioParam = searchParams.get("dataInicio");
    const dataFimParam = searchParams.get("dataFim");

    let de: Date, ate: Date;
    if (dataInicioParam && dataFimParam) {
      de = startOfDay(new Date(dataInicioParam));
      ate = endOfDay(new Date(dataFimParam));
    } else {
      ({ de, ate } = getPeriodRange(periodo, mes));
    }
    const canViewAllUsers = payload.role === "ADMINISTRADOR" || payload.role === "GESTOR";

    // Filtro por vendedor específico — só Gestor/Admin pode solicitar
    const vendedorId = canViewAllUsers ? (searchParams.get("vendedorId") || null) : null;

    // Filtro Prisma para clientes/leads
    const baseUserFilter = buildWhereClause(payload.role, payload.userId);
    const userFilter = vendedorId ? { responsavelId: vendedorId } : baseUserFilter;

    // Filtro SQL para queries de leads (tabela com alias "l")
    const leadsUserFilterSql = vendedorId
      ? Prisma.sql`AND l."responsavelId" = ${vendedorId}`
      : canViewAllUsers
        ? Prisma.empty
        : Prisma.sql`AND l."responsavelId" = ${payload.userId}`;

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
      canceladosPeriodo,
      canceladosAggregate,
    ] = await Promise.all([
      // Total de clientes cadastrados no período
      prisma.cliente.count({ where: { deletedAt: null, createdAt: { gte: de, lte: ate }, ...userFilter } }),

      // Leads ativos no período (não fechados)
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: { notIn: ["FECHADO_GANHO", "FECHADO_PERDIDO"] },
          createdAt: { gte: de, lte: ate },
          OR: [{ clienteId: null }, { cliente: { deletedAt: null } }],
          ...userFilter,
        },
      }),

      // Funil de vendas no período — valor usa COALESCE(c.valorOrcamento, l.valorEstimado)
      prisma.$queryRaw<Array<{ estagio: string; total: number; valor: number }>>(
        Prisma.sql`
          SELECT
            l.estagio::text AS estagio,
            COUNT(*)::int AS total,
            COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS valor
          FROM leads l
          LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
          WHERE l."deletedAt" IS NULL
            AND l."createdAt" >= ${de}
            AND l."createdAt" <= ${ate}
            AND (l."clienteId" IS NULL OR c.id IS NOT NULL)
            ${leadsUserFilterSql}
          GROUP BY l.estagio
        `
      ),

      // Leads por origem no período
      prisma.lead.groupBy({
        by: ["origem"],
        where: {
          deletedAt: null,
          createdAt: { gte: de, lte: ate },
          OR: [{ clienteId: null }, { cliente: { deletedAt: null } }],
          ...userFilter,
        },
        _count: { _all: true },
      }),

      // Leads ganhos no período (para kpis.leadsGanhos)
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: "FECHADO_GANHO",
          dataFechamento: { gte: de, lte: ate },
          OR: [{ clienteId: null }, { cliente: { deletedAt: null } }],
          ...userFilter,
        },
      }),

      // Valor em negociação no período — filtra por orcamentoEnviadoEm se disponível, senão por createdAt
      prisma.cliente.aggregate({
        where: {
          deletedAt: null,
          statusOrcamento: { notIn: ["APROVADO", "NAO_APROVADO"] },
          valorOrcamento: { not: null },
          OR: [
            { orcamentoEnviadoEm: { gte: de, lte: ate } },
            { orcamentoEnviadoEm: null, createdAt: { gte: de, lte: ate } },
          ],
          ...userFilter,
        },
        _sum: { valorOrcamento: true },
      }),

      // Receita fechada no período — via leads fechados com dataFechamento no range
      prisma.$queryRaw<Array<{ count: number; valor: number }>>(Prisma.sql`
        SELECT
          COUNT(*)::int AS count,
          COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS valor
        FROM leads l
        LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE l."deletedAt" IS NULL
          AND l.estagio = 'FECHADO_GANHO'::"EstagioLead"
          AND l."dataFechamento" >= ${de}
          AND l."dataFechamento" <= ${ate}
          AND (l."clienteId" IS NULL OR c.id IS NOT NULL)
          ${leadsUserFilterSql}
      `),

      // Total de leads criados no período (para taxa de conversão)
      prisma.lead.count({
        where: {
          deletedAt: null,
          createdAt: { gte: de, lte: ate },
          OR: [{ clienteId: null }, { cliente: { deletedAt: null } }],
          ...userFilter,
        },
      }),

      // Leads convertidos no período (para taxa de conversão)
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: "FECHADO_GANHO",
          dataFechamento: { gte: de, lte: ate },
          OR: [{ clienteId: null }, { cliente: { deletedAt: null } }],
          ...userFilter,
        },
      }),

      // Cancelamentos no período — contagem
      prisma.lead.count({
        where: {
          deletedAt: null,
          estagio: "FECHADO_PERDIDO",
          dataFechamento: { gte: de, lte: ate },
          OR: [{ clienteId: null }, { cliente: { deletedAt: null } }],
          ...userFilter,
        },
      }),

      // Cancelamentos — valor total no período via leads com dataFechamento no range
      prisma.$queryRaw<Array<{ valor: number }>>(Prisma.sql`
        SELECT
          COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS valor
        FROM leads l
        LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE l."deletedAt" IS NULL
          AND l.estagio = 'FECHADO_PERDIDO'::"EstagioLead"
          AND l."dataFechamento" >= ${de}
          AND l."dataFechamento" <= ${ate}
          AND (l."clienteId" IS NULL OR c.id IS NOT NULL)
          ${leadsUserFilterSql}
      `),
    ]);

    const receitaFechadaRow = (receitaFechadaPeriodo as Array<{ count: number; valor: number }>)[0];
    const receitaFechada  = receitaFechadaRow?.valor ?? 0;
    const vendasFechadas  = receitaFechadaRow?.count ?? 0;
    const ticketMedio     = vendasFechadas > 0 ? receitaFechada / vendasFechadas : 0;
    const canceladosValorRow = (canceladosAggregate as Array<{ valor: number }>)[0];
    const canceladosValor = canceladosValorRow?.valor ?? 0;
    const taxaConversao   = leadsTotal > 0 ? (leadsConvertidos / leadsTotal) * 100 : 0;

    const funnelFormatted = funnelData.map((f) => ({
      estagio: f.estagio,
      total:   Number(f.total),
      valor:   Number(f.valor),
    }));

    // Performance por vendedor — usa COALESCE(c.valorOrcamento, l.valorEstimado)
    const vendasPorVendedorRaw = await prisma.$queryRaw<Array<{ responsavelId: string; total: number; valor: number }>>(
      Prisma.sql`
        SELECT
          l."responsavelId",
          COUNT(*)::int AS total,
          COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS valor
        FROM leads l
        LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE l."deletedAt" IS NULL
          AND l.estagio = 'FECHADO_GANHO'::"EstagioLead"
          AND l."dataFechamento" >= ${de}
          AND l."dataFechamento" <= ${ate}
          AND (l."clienteId" IS NULL OR c.id IS NOT NULL)
          ${leadsUserFilterSql}
        GROUP BY l."responsavelId"
        ORDER BY valor DESC
        LIMIT 5
      `
    );

    const vendedorIds = vendasPorVendedorRaw.map((v) => v.responsavelId).filter(Boolean) as string[];
    const vendedores  = await prisma.user.findMany({
      where: { id: { in: vendedorIds } },
      select: { id: true, nome: true },
    });
    const vendasPorVendedor = vendasPorVendedorRaw.map((v) => ({
      vendedor: vendedores.find((u) => u.id === v.responsavelId)?.nome || "N/A",
      total:    Number(v.total),
      valor:    Number(v.valor),
    }));

    // Serviços mais solicitados — só para admins/gestores
    let servicosMaisSolicitados: Array<{ servico: string; total: number }> = [];
    if (canViewAllUsers) {
      servicosMaisSolicitados = await prisma.$queryRaw<Array<{ servico: string; total: number }>>(
        Prisma.sql`
          SELECT servico, COUNT(*)::int AS total
          FROM (
            SELECT trim(unnest(string_to_array("servicoBuscado", ','))) AS servico
            FROM clientes
            WHERE "deletedAt" IS NULL
              AND "servicoBuscado" IS NOT NULL
              AND "servicoBuscado" != ''
              AND "createdAt" >= ${de}
              AND "createdAt" <= ${ate}
          ) sub
          WHERE servico != ''
          GROUP BY servico
          ORDER BY total DESC
          LIMIT 10
        `
      );
    }

    // Vendas por dia — agrupado por dia dentro do período selecionado
    const vendasMesRaw = await prisma.$queryRaw<Array<{ dia: string; total: number; valor: number }>>(
      Prisma.sql`
        SELECT
          TO_CHAR(l."dataFechamento", 'DD/MM') AS dia,
          DATE(l."dataFechamento") AS data_ord,
          COUNT(*)::int AS total,
          COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS valor
        FROM leads l
        LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE l."deletedAt" IS NULL
          AND l.estagio = 'FECHADO_GANHO'::"EstagioLead"
          AND l."dataFechamento" >= ${de}
          AND l."dataFechamento" <= ${ate}
          AND (l."clienteId" IS NULL OR c.id IS NOT NULL)
          ${leadsUserFilterSql}
        GROUP BY TO_CHAR(l."dataFechamento", 'DD/MM'), DATE(l."dataFechamento")
        ORDER BY data_ord
      `
    );

    return NextResponse.json({
      data: {
        kpis: {
          totalClientes,
          leadsAtivos,
          oportunidadesAbertas: leadsAtivos,
          valorNegociacao: Number(valorNegociacaoAtual._sum?.valorOrcamento || 0),
          vendasFechadas,
          taxaConversao:      Math.round(taxaConversao * 10) / 10,
          ticketMedio:        Math.round(ticketMedio),
          faturamentoPrevisto: receitaFechada,
          leadsGanhos:        leadsGanhosPeriodo,
          canceladosPeriodo,
          canceladosValor,
        },
        funil:             funnelFormatted,
        vendasMes:         vendasMesRaw,
        leadsPorOrigem:    leadsPorOrigem.map((l) => ({ origem: l.origem, total: l._count._all })),
        vendasPorVendedor,
        servicosMaisSolicitados,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao carregar dashboard" }, { status: 500 });
  }
}
