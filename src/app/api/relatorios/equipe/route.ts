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

    const vendedores = await prisma.user.findMany({
      where: { deletedAt: null, ativo: true, role: { in: ["COMERCIAL", "GESTOR", "ADMINISTRADOR"] } },
      select: { id: true, nome: true, avatar: true, role: true },
      orderBy: { nome: "asc" },
    });

    const performance = await Promise.all(
      vendedores.map(async (v) => {
        const [leadsGerados, leadsAtivos, tarefasConcluidas, vendas] = await Promise.all([
          prisma.lead.count({
            where: { responsavelId: v.id, deletedAt: null, createdAt: { gte: de, lte: ate } },
          }),
          prisma.lead.count({
            where: {
              responsavelId: v.id,
              deletedAt: null,
              estagio: { notIn: ["FECHADO_GANHO", "FECHADO_PERDIDO"] },
            },
          }),
          prisma.tarefa.count({
            where: {
              responsavelId: v.id,
              deletedAt: null,
              status: "CONCLUIDA",
              dataConclusao: { gte: de, lte: ate },
            },
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
                AND l."responsavelId" = ${v.id}
            `
          ),
        ]);

        const vendasFechadas = Number(vendas[0]?.total || 0);
        const receitaGerada = Number(vendas[0]?.receita || 0);

        return {
          ...v,
          leadsGerados,
          leadsAtivos,
          tarefasConcluidas,
          vendasFechadas,
          receitaGerada,
          ticketMedio: vendasFechadas > 0 ? receitaGerada / vendasFechadas : 0,
        };
      })
    );

    return NextResponse.json({ data: performance });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar relatório de equipe" }, { status: 500 });
  }
}
