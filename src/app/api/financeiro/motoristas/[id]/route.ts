import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { motoristaUpdateSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = motoristaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const motorista = await prisma.financeiroMotorista.update({ where: { id: params.id }, data: parsed.data }).catch(() => null);
  if (!motorista) return NextResponse.json({ error: "Motorista não encontrado" }, { status: 404 });

  return NextResponse.json({ data: motorista });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const usos = await prisma.financeiroCarroUso.count({ where: { motoristaId: params.id } });
  if (usos > 0) {
    const motorista = await prisma.financeiroMotorista.update({ where: { id: params.id }, data: { ativo: false } });
    return NextResponse.json({ data: motorista, arquivado: true });
  }

  await prisma.financeiroMotorista.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
