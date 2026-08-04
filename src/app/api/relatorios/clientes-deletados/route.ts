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
    const de = new Date(searchParams.get("de") || new Date(new Date().setDate(1)).toISOString().split("T")[0]);
    const ate = new Date(searchParams.get("ate") || new Date().toISOString().split("T")[0]);
    ate.setHours(23, 59, 59, 999);

    const deletados = await prisma.cliente.findMany({
      where: {
        deletedAt: { not: null, gte: de, lte: ate },
      },
      include: {
        responsavel: { select: { id: true, nome: true } },
      },
      orderBy: { deletedAt: "desc" },
    });

    const totalValorPerdido = deletados.reduce((acc, c) => acc + Number(c.valorOrcamento ?? 0), 0);

    // Quem de fato executou a exclusão (nem sempre é o responsável do cliente)
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entidade: "Cliente",
        acao: "DELETE",
        entidadeId: { in: deletados.map((c) => c.id) },
      },
      select: { entidadeId: true, createdAt: true, user: { select: { nome: true } } },
      orderBy: { createdAt: "desc" },
    });
    const excluidoPorMap: Record<string, string> = {};
    for (const log of auditLogs) {
      if (!excluidoPorMap[log.entidadeId]) excluidoPorMap[log.entidadeId] = log.user?.nome || "—";
    }

    return NextResponse.json({
      data: {
        total: deletados.length,
        valorPerdido: totalValorPerdido,
        ticketMedio: deletados.length > 0 ? totalValorPerdido / deletados.length : 0,
        lista: deletados.map((c) => ({
          id: c.id,
          nome: c.nome,
          responsavel: c.responsavel?.nome || "—",
          excluidoPor: excluidoPorMap[c.id] || "—",
          servico: c.servicoBuscado || "—",
          temperatura: c.temperatura,
          deletedAt: c.deletedAt,
          motivoExclusao: c.motivoExclusao ?? null,
          valor: Number(c.valorOrcamento ?? 0),
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar relatório de clientes deletados" }, { status: 500 });
  }
}
