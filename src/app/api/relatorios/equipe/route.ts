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

    const vendedores = await prisma.user.findMany({
      where: { deletedAt: null, ativo: true, role: { in: ["COMERCIAL", "GESTOR"] } },
      select: { id: true, nome: true, avatar: true, role: true },
    });

    const performance = await Promise.all(
      vendedores.map(async (v) => {
        const [leads, opos, tarefas, ganhas] = await Promise.all([
          prisma.lead.count({ where: { responsavelId: v.id, deletedAt: null, createdAt: { gte: de, lte: ate } } }),
          prisma.oportunidade.count({ where: { responsavelId: v.id, deletedAt: null, status: "ABERTA" } }),
          prisma.tarefa.count({ where: { responsavelId: v.id, deletedAt: null, status: "CONCLUIDA", dataConclusao: { gte: de, lte: ate } } }),
          prisma.oportunidade.aggregate({
            where: { responsavelId: v.id, deletedAt: null, status: "GANHA", dataFechamento: { gte: de, lte: ate } },
            _sum: { valor: true },
            _count: true,
          }),
        ]);

        return {
          ...v,
          leadsGerados: leads,
          oportunidadesAbertas: opos,
          tarefasConcluidas: tarefas,
          vendasFechadas: ganhas._count,
          receitaGerada: Number(ganhas._sum?.valor || 0),
        };
      })
    );

    return NextResponse.json({ data: performance });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar relatório de equipe" }, { status: 500 });
  }
}
