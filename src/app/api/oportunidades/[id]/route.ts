import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { oportunidadeSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const oportunidade = await prisma.oportunidade.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true, email: true } },
        cliente: true,
        empresa: true,
        contato: true,
        lead: true,
        atividades: {
          include: { user: { select: { id: true, nome: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        comentarios: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, nome: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        },
        tarefas: { where: { deletedAt: null }, orderBy: { dataVencimento: "asc" } },
        anexos: { where: { deletedAt: null } },
      },
    });

    if (!oportunidade) return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });
    return NextResponse.json({ data: oportunidade });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "oportunidades:update");

    const old = await prisma.oportunidade.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!old) return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });

    const body = await request.json();
    const data = oportunidadeSchema.parse(body);

    const oportunidade = await prisma.oportunidade.update({ where: { id: params.id }, data });

    if (old.status !== oportunidade.status) {
      await prisma.atividade.create({
        data: {
          tipo: "ESTAGIO_ALTERADO",
          descricao: `Status alterado de "${old.status}" para "${oportunidade.status}"`,
          userId: payload.userId,
          oportunidadeId: params.id,
          metadata: { de: old.status, para: oportunidade.status },
        },
      });
    }

    await createAuditLog({
      userId: payload.userId, entidade: "Oportunidade", entidadeId: params.id, acao: "UPDATE",
      dadosAntigos: sanitizeForAudit(old as unknown as Record<string, unknown>),
      dadosNovos: sanitizeForAudit(data as unknown as Record<string, unknown>),
    });

    return NextResponse.json({ data: oportunidade });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar oportunidade" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "oportunidades:delete");

    await prisma.oportunidade.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Oportunidade removida" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover oportunidade" }, { status: 500 });
  }
}
