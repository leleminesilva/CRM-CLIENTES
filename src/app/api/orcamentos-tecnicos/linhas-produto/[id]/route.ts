import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { linhaProdutoSchema } from "@/lib/validators/catalogo";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:update")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const old = await prisma.linhaProduto.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!old) return NextResponse.json({ error: "Linha não encontrada" }, { status: 404 });

  const body = await request.json();
  const data = linhaProdutoSchema.partial().parse(body);

  const linha = await prisma.linhaProduto.update({ where: { id: params.id }, data });
  await createAuditLog({
    userId: payload.userId, entidade: "LinhaProduto", entidadeId: params.id, acao: "UPDATE",
    dadosAntigos: sanitizeForAudit(old), dadosNovos: sanitizeForAudit(data),
  });

  return NextResponse.json({ data: linha });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:delete")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const old = await prisma.linhaProduto.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!old) return NextResponse.json({ error: "Linha não encontrada" }, { status: 404 });

  await prisma.linhaProduto.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await createAuditLog({ userId: payload.userId, entidade: "LinhaProduto", entidadeId: params.id, acao: "DELETE" });

  return NextResponse.json({ message: "Linha removida" });
}
