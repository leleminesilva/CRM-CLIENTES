import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { varianteProdutoSchema } from "@/lib/validators/catalogo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const produtoId = searchParams.get("produtoId") || undefined;

  const variantes = await prisma.varianteProduto.findMany({
    where: { deletedAt: null, ...(produtoId ? { produtoId } : {}) },
    orderBy: { ordem: "asc" },
  });

  return NextResponse.json({ data: variantes });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:create")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const data = varianteProdutoSchema.parse(body);

  const variante = await prisma.varianteProduto.create({ data });
  await createAuditLog({ userId: payload.userId, entidade: "VarianteProduto", entidadeId: variante.id, acao: "CREATE", dadosNovos: data });

  return NextResponse.json({ data: variante }, { status: 201 });
}
