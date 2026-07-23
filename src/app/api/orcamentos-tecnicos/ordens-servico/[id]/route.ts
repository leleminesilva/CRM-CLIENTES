import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { ordemServicoUpdateSchema } from "@/lib/validators/ordemServico";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "ordens_servico:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const ordem = await prisma.ordemServico.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      vendedor: { select: { id: true, nome: true } },
      orcamento: {
        include: {
          cliente: { select: { id: true, nome: true } },
          itens: { orderBy: { ordem: "asc" }, include: { produto: true, variante: true } },
        },
      },
    },
  });

  if (!ordem) return NextResponse.json({ error: "Ordem de serviço não encontrada" }, { status: 404 });
  return NextResponse.json({ data: ordem });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "ordens_servico:update")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const old = await prisma.ordemServico.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!old) return NextResponse.json({ error: "Ordem de serviço não encontrada" }, { status: 404 });

  const body = await request.json();
  const data = ordemServicoUpdateSchema.parse(body);

  const ordem = await prisma.ordemServico.update({
    where: { id: params.id },
    data: {
      vendedorId: data.vendedorId !== undefined ? data.vendedorId : undefined,
      previsaoEntrega: data.previsaoEntrega ? new Date(data.previsaoEntrega) : undefined,
      progresso: data.progresso,
      status: data.status,
      concluidoEm: data.status === "CONCLUIDO" ? new Date() : data.status ? null : undefined,
      canceladoEm: data.status === "CANCELADO" ? new Date() : data.status ? null : undefined,
    },
  });

  await createAuditLog({
    userId: payload.userId, entidade: "OrdemServico", entidadeId: params.id, acao: "UPDATE",
    dadosAntigos: sanitizeForAudit(old), dadosNovos: sanitizeForAudit(data),
  });

  return NextResponse.json({ data: ordem });
}
