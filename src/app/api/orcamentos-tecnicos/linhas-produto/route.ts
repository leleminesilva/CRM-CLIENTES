import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { linhaProdutoSchema } from "@/lib/validators/catalogo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const linhas = await prisma.linhaProduto.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { produtos: { where: { deletedAt: null } } } },
    },
    orderBy: { ordem: "asc" },
  });

  return NextResponse.json({ data: linhas });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:create")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const data = linhaProdutoSchema.parse(body);

  const linha = await prisma.linhaProduto.create({ data });
  await createAuditLog({ userId: payload.userId, entidade: "LinhaProduto", entidadeId: linha.id, acao: "CREATE", dadosNovos: data });

  return NextResponse.json({ data: linha }, { status: 201 });
}
