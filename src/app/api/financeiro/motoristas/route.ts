import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { motoristaSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const incluirInativos = searchParams.get("todos") === "true";

  const motoristas = await prisma.financeiroMotorista.findMany({
    where: incluirInativos ? {} : { ativo: true },
    include: { _count: { select: { usos: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  return NextResponse.json({ data: motoristas });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = motoristaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const motorista = await prisma.financeiroMotorista.create({ data: parsed.data });
  return NextResponse.json({ data: motorista }, { status: 201 });
}
