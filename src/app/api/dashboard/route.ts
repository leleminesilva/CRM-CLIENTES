import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildWhereClause, canViewAll } from "@/lib/rbac";
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
    const canViewAllUsers = canViewAll(payload.role);

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

    // Filtro SQL para queries de vendas fechadas (tabela com alias "v")
    const vendasUserFilterSql = vendedorId
      ? Prisma.sql`AND v."responsavelId" = ${vendedorId}`
      : canViewAllUsers
        ? Prisma.empty
        : Prisma.sql`AND v."responsavelId" = ${payload.userId}`;

    const [
      totalClientes,
      leadsAtivos,
      leadsPorOrigem,
      vendasPorOrigem,
      leadsGanhosPeriodo,
      valorNegociacaoAtual,
      receitaFechadaPeriodo,
      leadsTotal,
      leadsConvertidos,
      canceladosPeriodo,
      canceladosAggregate,
      valorNegociacaoFinal,
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

      // Leads por origem no período (todos, independente do estágio)
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

      // Origem das vendas fechadas no período — mesmo critério (tabela vendas)
      // usado em "Vendas Fechadas"/"Receita Fechada" nesse dashboard
      prisma.$queryRaw<Array<{ origem: string; count: number }>>(Prisma.sql`
        SELECT c.origem::text AS origem, COUNT(*)::int AS count
        FROM vendas v
        LEFT JOIN clientes c ON v."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE v."deletedAt" IS NULL
          AND v.data >= ${de} AND v.data <= ${ate}
          ${vendasUserFilterSql}
        GROUP BY c.origem
      `),

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

      // Valor em negociação — Primeiro Orçamento no período
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

      // Receita fechada no período — via vendas confirmadas com data no range
      prisma.$queryRaw<Array<{ count: number; valor: number }>>(Prisma.sql`
        SELECT
          COUNT(*)::int AS count,
          COALESCE(SUM(v.valor), 0)::float AS valor
        FROM vendas v
        LEFT JOIN clientes c ON v."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE v."deletedAt" IS NULL
          AND v.data >= ${de}
          AND v.data <= ${ate}
          ${vendasUserFilterSql}
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

      // Valor em negociação — Orçamento Final no período (campos separados)
      prisma.cliente.aggregate({
        where: {
          deletedAt: null,
          statusOrcamento: { notIn: ["APROVADO", "NAO_APROVADO"] },
          orcamentoFinalEm: { gte: de, lte: ate },
          orcamentoFinalValor: { not: null },
          ...userFilter,
        },
        _sum: { orcamentoFinalValor: true },
      }),
    ]);

    const receitaFechadaRow = (receitaFechadaPeriodo as Array<{ count: number; valor: number }>)[0];
    const receitaFechada  = receitaFechadaRow?.valor ?? 0;
    const vendasFechadas  = receitaFechadaRow?.count ?? 0;
    const ticketMedio     = vendasFechadas > 0 ? receitaFechada / vendasFechadas : 0;
    const canceladosValorRow = (canceladosAggregate as Array<{ valor: number }>)[0];
    const canceladosValor = canceladosValorRow?.valor ?? 0;
    const taxaConversao   = leadsTotal > 0 ? (leadsConvertidos / leadsTotal) * 100 : 0;

    // Performance por vendedor — soma direta do valor de cada venda confirmada
    const vendasPorVendedorRaw = await prisma.$queryRaw<Array<{ responsavelId: string; total: number; valor: number }>>(
      Prisma.sql`
        SELECT
          v."responsavelId",
          COUNT(*)::int AS total,
          COALESCE(SUM(v.valor), 0)::float AS valor
        FROM vendas v
        LEFT JOIN clientes c ON v."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE v."deletedAt" IS NULL
          AND v.data >= ${de}
          AND v.data <= ${ate}
          ${vendasUserFilterSql}
        GROUP BY v."responsavelId"
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
          TO_CHAR(v.data, 'DD/MM') AS dia,
          DATE(v.data) AS data_ord,
          COUNT(*)::int AS total,
          COALESCE(SUM(v.valor), 0)::float AS valor
        FROM vendas v
        LEFT JOIN clientes c ON v."clienteId" = c.id AND c."deletedAt" IS NULL
        WHERE v."deletedAt" IS NULL
          AND v.data >= ${de}
          AND v.data <= ${ate}
          ${vendasUserFilterSql}
        GROUP BY TO_CHAR(v.data, 'DD/MM'), DATE(v.data)
        ORDER BY data_ord
      `
    );

    // Vendas por dia, por vendedor — só dos vendedores que já aparecem em "Performance por
    // Vendedor" (top 5), pra desenhar uma linha individual de cada um no mesmo gráfico.
    let vendasMesPorVendedor: Array<{ dia: string; responsavelId: string; valor: number }> = [];
    if (vendedorIds.length > 0) {
      vendasMesPorVendedor = await prisma.$queryRaw<Array<{ dia: string; data_ord: Date; responsavelId: string; valor: number }>>(
        Prisma.sql`
          SELECT
            TO_CHAR(v.data, 'DD/MM') AS dia,
            DATE(v.data) AS data_ord,
            v."responsavelId",
            COALESCE(SUM(v.valor), 0)::float AS valor
          FROM vendas v
          LEFT JOIN clientes c ON v."clienteId" = c.id AND c."deletedAt" IS NULL
          WHERE v."deletedAt" IS NULL
            AND v.data >= ${de}
            AND v.data <= ${ate}
            AND v."responsavelId" IN (${Prisma.join(vendedorIds)})
          GROUP BY TO_CHAR(v.data, 'DD/MM'), DATE(v.data), v."responsavelId"
          ORDER BY data_ord
        `
      );
    }

    // Pivota pra um formato largo (uma coluna por vendedor) — o que o gráfico de linhas espera
    const vendasMesComVendedores = vendasMesRaw.map((dia) => {
      const linha: Record<string, string | number> = { dia: dia.dia, total: Number(dia.valor) };
      for (const v of vendedores) {
        const registro = vendasMesPorVendedor.find((x) => x.dia === dia.dia && x.responsavelId === v.id);
        linha[v.nome] = registro ? Number(registro.valor) : 0;
      }
      return linha;
    });

    return NextResponse.json({
      data: {
        kpis: {
          totalClientes,
          leadsAtivos,
          oportunidadesAbertas: leadsAtivos,
          valorNegociacao: Number(valorNegociacaoAtual._sum?.valorOrcamento || 0) + Number((valorNegociacaoFinal as { _sum: { orcamentoFinalValor?: unknown } })._sum?.orcamentoFinalValor || 0),
          vendasFechadas,
          taxaConversao:      Math.round(taxaConversao * 10) / 10,
          ticketMedio:        Math.round(ticketMedio),
          faturamentoPrevisto: receitaFechada,
          leadsGanhos:        leadsGanhosPeriodo,
          canceladosPeriodo,
          canceladosValor,
        },
        vendasMes:         vendasMesComVendedores,
        // Mesma ordem de vendasPorVendedor (por valor desc) — garante que a cor de cada
        // linha aqui bata com a cor da barra dele em "Performance por Vendedor"
        vendedorNomes:     vendasPorVendedor.map((v) => v.vendedor),
        leadsPorOrigem:    leadsPorOrigem.map((l) => ({ origem: l.origem, total: l._count._all })),
        vendasPorOrigem:   vendasPorOrigem.map((v) => ({ origem: v.origem, total: Number(v.count) })),
        vendasPorVendedor,
        servicosMaisSolicitados,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao carregar dashboard" }, { status: 500 });
  }
}
