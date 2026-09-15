import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { categoriaSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const categorias = await prisma.financeiroCategoria.findMany({ orderBy: [{ tipo: "asc" }, { nome: "asc" }] });
  return NextResponse.json({ data: categorias });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = categoriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existe = await prisma.financeiroCategoria.findUnique({
    where: { nome_tipo: { nome: parsed.data.nome, tipo: parsed.data.tipo } },
  });
  if (existe) return NextResponse.json({ error: "Já existe uma categoria com esse nome nesse tipo" }, { status: 409 });

  const categoria = await prisma.financeiroCategoria.create({ data: parsed.data });
  return NextResponse.json({ data: categoria }, { status: 201 });
}
