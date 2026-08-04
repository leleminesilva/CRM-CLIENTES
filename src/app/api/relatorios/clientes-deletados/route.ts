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

    // Agrupamento por categoria do motivo (parte antes do " — ")
    const porMotivoMap: Record<string, number> = {};
    for (const c of deletados) {
      const cat = c.motivoExclusao ? c.motivoExclusao.split(" — ")[0].trim() : "Sem motivo informado";
      porMotivoMap[cat] = (porMotivoMap[cat] || 0) + 1;
    }

    // Agrupamento por responsável
    const porResponsavelMap: Record<string, { nome: string; total: number; valor: number }> = {};
    for (const c of deletados) {
      const id = c.responsavelId || "sem-resp";
      const nome = c.responsavel?.nome || "Sem responsável";
      if (!porResponsavelMap[id]) porResponsavelMap[id] = { nome, total: 0, valor: 0 };
      porResponsavelMap[id].total += 1;
      porResponsavelMap[id].valor += Number(c.valorOrcamento ?? 0);
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
          servico: c.servicoBuscado || "—",
          temperatura: c.temperatura,
          deletedAt: c.deletedAt,
          motivoExclusao: c.motivoExclusao ?? null,
          valor: Number(c.valorOrcamento ?? 0),
        })),
        porMotivo: Object.entries(porMotivoMap)
          .map(([motivo, total]) => ({ motivo, total }))
          .sort((a, b) => b.total - a.total),
        porResponsavel: Object.values(porResponsavelMap).sort((a, b) => b.total - a.total),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar relatório de clientes deletados" }, { status: 500 });
  }
}
