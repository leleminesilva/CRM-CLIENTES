import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { empresaSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const empresa = await prisma.empresa.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        contatos: { where: { deletedAt: null }, orderBy: [{ principal: "desc" }, { nome: "asc" }] },
        _count: { select: { clientes: true, leads: true, oportunidades: true } },
      },
    });

    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    return NextResponse.json({ data: empresa });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "empresas:update");

    const old = await prisma.empresa.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!old) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    const body = await request.json();
    const data = empresaSchema.parse(body);
    const empresa = await prisma.empresa.update({ where: { id: params.id }, data });

    await createAuditLog({
      userId: payload.userId, entidade: "Empresa", entidadeId: params.id, acao: "UPDATE",
      dadosAntigos: sanitizeForAudit(old as unknown as Record<string, unknown>),
      dadosNovos: sanitizeForAudit(data as unknown as Record<string, unknown>),
    });

    return NextResponse.json({ data: empresa });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar empresa" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "empresas:delete");

    await prisma.empresa.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Empresa removida" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover empresa" }, { status: 500 });
  }
}
