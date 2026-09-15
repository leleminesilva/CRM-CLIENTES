import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { contaUpdateSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = contaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const conta = await prisma.financeiroConta.update({ where: { id: params.id }, data: parsed.data }).catch(() => null);
  if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  return NextResponse.json({ data: conta });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const lancamentos = await prisma.financeiroLancamento.count({ where: { contaId: params.id } });
  if (lancamentos > 0) {
    // Não apaga conta com histórico — só arquiva, pra não perder os lançamentos já feitos.
    const conta = await prisma.financeiroConta.update({ where: { id: params.id }, data: { ativa: false } });
    return NextResponse.json({ data: conta, arquivada: true });
  }

  await prisma.financeiroConta.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
