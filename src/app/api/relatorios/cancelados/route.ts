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

    const cancelados = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        estagio: "FECHADO_PERDIDO",
        dataFechamento: { gte: de, lte: ate },
      },
      include: {
        cliente: {
          select: { id: true, nome: true, servicoBuscado: true, valorOrcamento: true, temperatura: true },
        },
        responsavel: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { dataFechamento: "desc" },
    });

    const totalValorPerdido = cancelados.reduce(
      (acc, l) => acc + Number(l.cliente?.valorOrcamento ?? l.valorEstimado ?? 0),
      0
    );

    // Agrupamento por categoria do motivo (parte antes do " — ")
    const porMotivoMap: Record<string, number> = {};
    for (const lead of cancelados) {
      const cat = lead.motivoPerda
        ? lead.motivoPerda.split(" — ")[0].trim()
        : "Sem motivo informado";
      porMotivoMap[cat] = (porMotivoMap[cat] || 0) + 1;
    }

    // Agrupamento por responsável
    const porResponsavelMap: Record<string, { nome: string; total: number; valor: number }> = {};
    for (const lead of cancelados) {
      const id = lead.responsavelId || "sem-resp";
      const nome = lead.responsavel?.nome || "Sem responsável";
      if (!porResponsavelMap[id]) porResponsavelMap[id] = { nome, total: 0, valor: 0 };
      porResponsavelMap[id].total += 1;
      porResponsavelMap[id].valor += Number(lead.cliente?.valorOrcamento ?? lead.valorEstimado ?? 0);
    }

    // Agrupamento por serviço
    const porServicoMap: Record<string, number> = {};
    for (const lead of cancelados) {
      const servicos = lead.cliente?.servicoBuscado
        ?.split(",").map((s) => s.trim()).filter(Boolean) ?? ["Sem serviço"];
      for (const s of servicos) {
        porServicoMap[s] = (porServicoMap[s] || 0) + 1;
      }
    }

    return NextResponse.json({
      data: {
        total: cancelados.length,
        valorPerdido: totalValorPerdido,
        ticketMedio: cancelados.length > 0 ? totalValorPerdido / cancelados.length : 0,
        lista: cancelados.map((l) => ({
          id: l.id,
          clienteId: l.clienteId,
          clienteNome: l.cliente?.nome || l.titulo,
          responsavel: l.responsavel?.nome || "—",
          servico: l.cliente?.servicoBuscado || "—",
          temperatura: l.cliente?.temperatura ?? l.temperatura,
          dataFechamento: l.dataFechamento,
          motivoPerda: l.motivoPerda ?? null,
          valor: Number(l.cliente?.valorOrcamento ?? l.valorEstimado ?? 0),
        })),
        porMotivo: Object.entries(porMotivoMap)
          .map(([motivo, total]) => ({ motivo, total }))
          .sort((a, b) => b.total - a.total),
        porResponsavel: Object.values(porResponsavelMap).sort((a, b) => b.total - a.total),
        porServico: Object.entries(porServicoMap)
          .map(([servico, total]) => ({ servico, total }))
          .sort((a, b) => b.total - a.total),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar relatório de cancelados" }, { status: 500 });
  }
}
