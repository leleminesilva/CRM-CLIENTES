import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { aprovarOrcamentoSchema } from "@/lib/validators/ordemServico";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "orcamentos_tecnicos:aprovar")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orcamento = await prisma.orcamentoTecnico.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { ordemServico: true },
  });
  if (!orcamento) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  if (orcamento.ordemServico) return NextResponse.json({ error: "Este orçamento já foi aprovado" }, { status: 400 });
  if (orcamento.status === "APROVADO" || orcamento.status === "REPROVADO") {
    return NextResponse.json({ error: "Orçamento já foi finalizado" }, { status: 400 });
  }

  const body = await request.json();
  const data = aprovarOrcamentoSchema.parse(body);

  const [, ordemServico] = await prisma.$transaction([
    prisma.orcamentoTecnico.update({ where: { id: params.id }, data: { status: "APROVADO" } }),
    prisma.ordemServico.create({
      data: {
        orcamentoId: params.id,
        vendedorId: data.vendedorId || orcamento.responsavelId,
        previsaoEntrega: new Date(data.previsaoEntrega),
      },
    }),
  ]);

  await createAuditLog({ userId: payload.userId, entidade: "OrcamentoTecnico", entidadeId: params.id, acao: "APROVAR", dadosNovos: { ordemServicoId: ordemServico.id } });

  return NextResponse.json({ data: ordemServico }, { status: 201 });
}
