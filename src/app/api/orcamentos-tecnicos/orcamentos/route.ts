import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { orcamentoTecnicoSchema } from "@/lib/validators/orcamentoTecnico";
import { calcularOrcamento } from "@/lib/orcamentosTecnicos/calc";
import { montarItensCalculados } from "@/lib/orcamentosTecnicos/montarItens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "orcamentos_tecnicos:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || undefined;

  const where: Record<string, unknown> = { deletedAt: null, ...(status ? { status } : {}) };

  const [data, total] = await Promise.all([
    prisma.orcamentoTecnico.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        ordemServico: { select: { id: true, status: true } },
        _count: { select: { itens: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orcamentoTecnico.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "orcamentos_tecnicos:create")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const data = orcamentoTecnicoSchema.parse(body);

  try {
    const itensCalculados = await montarItensCalculados(data.itens);
    const { subtotal, valorTotal } = calcularOrcamento(
      itensCalculados.map(i => i.totalItem),
      data.descontoPercentual,
      data.descontoValor
    );

    const orcamento = await prisma.orcamentoTecnico.create({
      data: {
        clienteId: data.clienteId || null,
        responsavelId: data.responsavelId || payload.userId,
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

    await createAuditLog({ userId: payload.userId, entidade: "OrcamentoTecnico", entidadeId: orcamento.id, acao: "CREATE", dadosNovos: { numero: orcamento.numero, valorTotal } });

    return NextResponse.json({ data: orcamento }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar orçamento" }, { status: 400 });
  }
}
