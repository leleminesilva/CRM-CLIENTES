import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { leadSchema } from "@/lib/validators/lead";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const lead = await prisma.lead.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true, email: true } },
        cliente: true,
        empresa: true,
        contato: true,
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
        anexos: { where: { deletedAt: null } },
        oportunidades: { where: { deletedAt: null } },
        tarefas: { where: { deletedAt: null }, orderBy: { dataVencimento: "asc" } },
      },
    });

    if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    return NextResponse.json({ data: lead });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "leads:update");

    const old = await prisma.lead.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!old) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    const body = await request.json();
    const data = leadSchema.parse(body);

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: { ...data, valorEstimado: data.valorEstimado ?? null },
    });

    if (old.estagio !== lead.estagio) {
      await prisma.atividade.create({
        data: {
          tipo: "ESTAGIO_ALTERADO",
          descricao: `Estágio alterado de "${old.estagio}" para "${lead.estagio}"`,
          userId: payload.userId,
          leadId: params.id,
          metadata: { de: old.estagio, para: lead.estagio },
        },
      });
    }

    await createAuditLog({
      userId: payload.userId,
      entidade: "Lead",
      entidadeId: params.id,
      acao: "UPDATE",
      dadosAntigos: sanitizeForAudit(old as unknown as Record<string, unknown>),
      dadosNovos: sanitizeForAudit(data as unknown as Record<string, unknown>),
    });

    return NextResponse.json({ data: lead });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar lead" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "leads:delete");

    await prisma.lead.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await createAuditLog({ userId: payload.userId, entidade: "Lead", entidadeId: params.id, acao: "DELETE" });
    return NextResponse.json({ message: "Lead removido com sucesso" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover lead" }, { status: 500 });
  }
}
