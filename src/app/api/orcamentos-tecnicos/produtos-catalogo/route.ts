import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { produtoCatalogoSchema } from "@/lib/validators/catalogo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const linhaId = searchParams.get("linhaId") || undefined;

  const produtos = await prisma.produtoCatalogo.findMany({
    where: { deletedAt: null, ...(linhaId ? { linhaId } : {}) },
    include: {
      _count: { select: { variantes: { where: { deletedAt: null } } } },
    },
    orderBy: { ordem: "asc" },
  });

  return NextResponse.json({ data: produtos });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:create")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const data = produtoCatalogoSchema.parse(body);

  const produto = await prisma.produtoCatalogo.create({ data });
  await createAuditLog({ userId: payload.userId, entidade: "ProdutoCatalogo", entidadeId: produto.id, acao: "CREATE", dadosNovos: data });

  return NextResponse.json({ data: produto }, { status: 201 });
}
