import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroUpdateSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = { ...parsed.data, ...(parsed.data.placa ? { placa: parsed.data.placa.toUpperCase() } : {}) };

  const carro = await prisma.financeiroCarro.update({ where: { id: params.id }, data }).catch(() => null);
  if (!carro) return NextResponse.json({ error: "Carro não encontrado" }, { status: 404 });

  return NextResponse.json({ data: carro });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const usos = await prisma.financeiroCarroUso.count({ where: { carroId: params.id } });
  if (usos > 0) {
    const carro = await prisma.financeiroCarro.update({ where: { id: params.id }, data: { ativo: false } });
    return NextResponse.json({ data: carro, arquivado: true });
  }

  await prisma.financeiroCarro.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
