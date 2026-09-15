import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { contaSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const incluirInativas = searchParams.get("todas") === "true";

  const [contas, somaPorConta] = await Promise.all([
    prisma.financeiroConta.findMany({
      where: incluirInativas ? {} : { ativa: true },
      include: { _count: { select: { lancamentos: true } } },
      orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    }),
    prisma.financeiroLancamento.groupBy({ by: ["contaId", "tipo"], _sum: { valor: true } }),
  ]);

  const somaPorId = new Map<string, number>();
  for (const linha of somaPorConta) {
    const atual = somaPorId.get(linha.contaId) ?? 0;
    const valor = Number(linha._sum.valor ?? 0);
    somaPorId.set(linha.contaId, atual + (linha.tipo === "ENTRADA" ? valor : -valor));
  }

  const data = contas.map((c) => ({ ...c, saldo: Number(c.saldoInicial) + (somaPorId.get(c.id) ?? 0) }));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = contaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const conta = await prisma.financeiroConta.create({ data: parsed.data });
  return NextResponse.json({ data: conta }, { status: 201 });
}
