import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { lancamentoUpdateSchema } from "@/lib/validators/financeiro";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = lancamentoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const antigo = await prisma.financeiroLancamento.findUnique({ where: { id: params.id } });
  if (!antigo) return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.data) data.data = new Date(parsed.data.data);
  if ("categoriaId" in parsed.data) data.categoriaId = parsed.data.categoriaId || null;

  const lancamento = await prisma.financeiroLancamento.update({
    where: { id: params.id },
    data,
    include: {
      conta: { select: { id: true, nome: true, cor: true } },
      categoria: { select: { id: true, nome: true, cor: true } },
      criadoPor: { select: { id: true, nome: true } },
    },
  });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroLancamento",
    entidadeId: params.id,
    acao: "UPDATE",
    dadosAntigos: { valor: Number(antigo.valor), descricao: antigo.descricao },
    dadosNovos: { valor: Number(lancamento.valor), descricao: lancamento.descricao },
  });

  return NextResponse.json({ data: lancamento });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const lancamento = await prisma.financeiroLancamento.delete({ where: { id: params.id } }).catch(() => null);
  if (!lancamento) return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroLancamento",
    entidadeId: params.id,
    acao: "DELETE",
    dadosAntigos: { valor: Number(lancamento.valor), descricao: lancamento.descricao },
  });

  return NextResponse.json({ ok: true });
}
