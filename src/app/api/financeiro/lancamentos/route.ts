import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { lancamentoSchema } from "@/lib/validators/financeiro";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const contaId = searchParams.get("contaId");
  const categoriaId = searchParams.get("categoriaId");
  const tipo = searchParams.get("tipo");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const busca = searchParams.get("busca");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "30")));

  const where: Record<string, unknown> = {};
  if (contaId) where.contaId = contaId;
  if (categoriaId) where.categoriaId = categoriaId;
  if (tipo === "ENTRADA" || tipo === "SAIDA") where.tipo = tipo;
  if (busca) where.descricao = { contains: busca, mode: "insensitive" };
  if (de || ate) {
    where.data = {
      ...(de ? { gte: new Date(`${de}T00:00:00`) } : {}),
      ...(ate ? { lte: new Date(`${ate}T23:59:59`) } : {}),
    };
  }

  const [lancamentos, total] = await Promise.all([
    prisma.financeiroLancamento.findMany({
      where,
      include: {
        conta: { select: { id: true, nome: true, cor: true } },
        categoria: { select: { id: true, nome: true, cor: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.financeiroLancamento.count({ where }),
  ]);

  return NextResponse.json({ data: lancamentos, total, page, limit });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = lancamentoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const conta = await prisma.financeiroConta.findUnique({ where: { id: parsed.data.contaId } });
  if (!conta || !conta.ativa) {
    return NextResponse.json({ error: "Conta inválida ou arquivada" }, { status: 400 });
  }

  const lancamento = await prisma.financeiroLancamento.create({
    data: {
      contaId: parsed.data.contaId,
      categoriaId: parsed.data.categoriaId || null,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao,
      valor: parsed.data.valor,
      data: new Date(parsed.data.data),
      criadoPorId: auth.payload.userId,
    },
    include: {
      conta: { select: { id: true, nome: true, cor: true } },
      categoria: { select: { id: true, nome: true, cor: true } },
      criadoPor: { select: { id: true, nome: true } },
    },
  });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroLancamento",
    entidadeId: lancamento.id,
    acao: "CREATE",
    dadosNovos: { tipo: lancamento.tipo, valor: parsed.data.valor, descricao: lancamento.descricao, contaId: lancamento.contaId },
  });

  return NextResponse.json({ data: lancamento }, { status: 201 });
}
