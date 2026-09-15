import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { categoriaSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = categoriaSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const categoria = await prisma.financeiroCategoria.update({ where: { id: params.id }, data: parsed.data }).catch(() => null);
  if (!categoria) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });

  return NextResponse.json({ data: categoria });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  // Lançamentos que usavam essa categoria ficam sem categoria (onDelete: SetNull), não são apagados.
  await prisma.financeiroCategoria.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
