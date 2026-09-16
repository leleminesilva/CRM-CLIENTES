import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";

export const dynamic = "force-dynamic";

// Só essas entidades aparecem aqui — auditoria do resto do CRM continua
// isolada em /auditoria (permissão e escopo diferentes: financeiro é liberado
// por pessoa, não por cargo — ver requireFinanceiroAccess).
const ENTIDADES_FINANCEIRO = [
  "FinanceiroCarroUso",
  "FinanceiroCarro",
  "FinanceiroMotorista",
  "FinanceiroLancamento",
  "FinanceiroConta",
  "FinanceiroCategoria",
];

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const entidade = searchParams.get("entidade");
  const acao = searchParams.get("acao");
  const userId = searchParams.get("userId");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

  const where: Record<string, unknown> = {
    entidade: entidade && ENTIDADES_FINANCEIRO.includes(entidade) ? entidade : { in: ENTIDADES_FINANCEIRO },
  };
  if (acao) where.acao = acao;
  if (userId) where.userId = userId;
  if (de || ate) {
    where.createdAt = {
      ...(de ? { gte: new Date(`${de}T00:00:00`) } : {}),
      ...(ate ? { lte: new Date(`${ate}T23:59:59`) } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, nome: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}
