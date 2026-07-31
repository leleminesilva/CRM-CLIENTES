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

    const [receitaFechada, receitaPrevista, receitaPorMes, funil, topClientes] = await Promise.all([
      // Receita fechada no período via vendas confirmadas
      prisma.$queryRaw<Array<{ total: number; receita: number }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS total,
            COALESCE(SUM(v.valor), 0)::float AS receita
          FROM vendas v
          WHERE v."deletedAt" IS NULL
            AND v.data >= ${de}
            AND v.data <= ${ate}
        `
      ),

      // Receita em negociação atual (fonte de verdade: valorOrcamento do cliente)
      prisma.cliente.aggregate({
        where: {
          deletedAt: null,
          statusOrcamento: { notIn: ["APROVADO", "NAO_APROVADO"] },
          valorOrcamento: { not: null },
        },
        _sum: { valorOrcamento: true },
      }),

      // Receita fechada por mês dentro do período
      prisma.$queryRaw<Array<{ mes: string; total: number; receita: number }>>(
        Prisma.sql`
          SELECT
            TO_CHAR(v.data, 'MM/YYYY') AS mes,
            DATE_TRUNC('month', v.data) AS mes_ord,
            COUNT(*)::int AS total,
            COALESCE(SUM(v.valor), 0)::float AS receita
          FROM vendas v
          WHERE v."deletedAt" IS NULL
            AND v.data >= ${de}
            AND v.data <= ${ate}
          GROUP BY TO_CHAR(v.data, 'MM/YYYY'), DATE_TRUNC('month', v.data)
          ORDER BY mes_ord
        `
      ),

      // Valor em cada estágio do funil (COALESCE)
      prisma.$queryRaw<Array<{ estagio: string; total: number; valor: number }>>(
        Prisma.sql`
          SELECT l.estagio::text AS estagio, COUNT(*)::int AS total,
            COALESCE(SUM(COALESCE(c."valorOrcamento", l."valorEstimado")), 0)::float AS valor
          FROM leads l
          LEFT JOIN clientes c ON l."clienteId" = c.id AND c."deletedAt" IS NULL
          WHERE l."deletedAt" IS NULL
            AND (l."clienteId" IS NULL OR c.id IS NOT NULL)
          GROUP BY l.estagio
          ORDER BY valor DESC
        `
      ),

      // Top 10 clientes por valor de orçamento
      prisma.cliente.findMany({
        where: { deletedAt: null, valorOrcamento: { not: null } },
        select: {
          id: true,
          nome: true,
          valorOrcamento: true,
          statusOrcamento: true,
          responsavel: { select: { nome: true } },
        },
        orderBy: { valorOrcamento: "desc" },
        take: 10,
      }),
    ]);

    const totalVendas = Number(receitaFechada[0]?.total || 0);
    const receita = Number(receitaFechada[0]?.receita || 0);

    return NextResponse.json({
      data: {
        receitaFechada: receita,
        totalVendas,
        ticketMedio: totalVendas > 0 ? receita / totalVendas : 0,
        receitaPrevista: Number(receitaPrevista._sum?.valorOrcamento || 0),
        receitaPorMes: receitaPorMes.map((r) => ({
          mes: r.mes,
          total: Number(r.total),
          receita: Number(r.receita),
        })),
        funil: funil.map((f) => ({
          estagio: f.estagio,
          total: Number(f.total),
          valor: Number(f.valor),
        })),
        topClientes: topClientes.map((c) => ({
          id: c.id,
          nome: c.nome,
          valor: Number(c.valorOrcamento),
          status: c.statusOrcamento,
          responsavel: c.responsavel?.nome || "—",
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar relatório financeiro" }, { status: 500 });
  }
}
