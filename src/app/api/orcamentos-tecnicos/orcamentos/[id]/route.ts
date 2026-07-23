import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { orcamentoTecnicoSchema } from "@/lib/validators/orcamentoTecnico";
import { calcularOrcamento } from "@/lib/orcamentosTecnicos/calc";
import { montarItensCalculados } from "@/lib/orcamentosTecnicos/montarItens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "orcamentos_tecnicos:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orcamento = await prisma.orcamentoTecnico.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      cliente: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      ordemServico: true,
      itens: {
        orderBy: { ordem: "asc" },
        include: {
          produto: { include: { linha: true } },
          variante: true,
        },
      },
    },
  });

  if (!orcamento) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  return NextResponse.json({ data: orcamento });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "orcamentos_tecnicos:update")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const old = await prisma.orcamentoTecnico.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!old) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

  const body = await request.json();
  const data = orcamentoTecnicoSchema.parse(body);

  try {
    const itensCalculados = await montarItensCalculados(data.itens);
    const { subtotal, valorTotal } = calcularOrcamento(
      itensCalculados.map(i => i.totalItem),
      data.descontoPercentual,
      data.descontoValor
    );

    const orcamento = await prisma.$transaction(async tx => {
      await tx.itemOrcamentoTecnico.deleteMany({ where: { orcamentoId: params.id } });
      return tx.orcamentoTecnico.update({
        where: { id: params.id },
        data: {
          clienteId: data.clienteId || null,
          responsavelId: data.responsavelId || old.responsavelId,
          bairroInstalacao: data.bairroInstalacao || null,
          enderecoInstalacao: data.enderecoInstalacao || null,
          observacoes: data.observacoes || null,
          descontoPercentual: data.descontoPercentual ?? null,
          descontoValor: data.descontoValor ?? null,
          subtotal,
          valorTotal,
          itens: { create: itensCalculados },
        },
        include: { itens: true },
      });
    });

    await createAuditLog({ userId: payload.userId, entidade: "OrcamentoTecnico", entidadeId: params.id, acao: "UPDATE", dadosNovos: { valorTotal } });

    return NextResponse.json({ data: orcamento });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao atualizar orçamento" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "orcamentos_tecnicos:delete")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const old = await prisma.orcamentoTecnico.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!old) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

  await prisma.orcamentoTecnico.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await createAuditLog({ userId: payload.userId, entidade: "OrcamentoTecnico", entidadeId: params.id, acao: "DELETE" });

  return NextResponse.json({ message: "Orçamento removido" });
}
