import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { contatoSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const contato = await prisma.contato.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        empresa: true,
        comentarios: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, nome: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contato) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    return NextResponse.json({ data: contato });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "contatos:update");

    const old = await prisma.contato.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!old) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

    const body = await request.json();
    const data = contatoSchema.parse(body);
    const contato = await prisma.contato.update({ where: { id: params.id }, data });

    await createAuditLog({
      userId: payload.userId, entidade: "Contato", entidadeId: params.id, acao: "UPDATE",
      dadosAntigos: sanitizeForAudit(old as unknown as Record<string, unknown>),
      dadosNovos: sanitizeForAudit(data as unknown as Record<string, unknown>),
    });

    return NextResponse.json({ data: contato });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar contato" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "contatos:delete");

    await prisma.contato.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Contato removido" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover contato" }, { status: 500 });
  }
}
