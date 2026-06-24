import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { tarefaSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const tarefa = await prisma.tarefa.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true } },
        cliente: { select: { id: true, nome: true } },
        lead: { select: { id: true, titulo: true } },
        oportunidade: { select: { id: true, titulo: true } },
        atividades: {
          include: { user: { select: { id: true, nome: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!tarefa) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    return NextResponse.json({ data: tarefa });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "tarefas:update");

    const body = await request.json();

    // Check if just completing the task
    if (body.concluir) {
      const tarefa = await prisma.tarefa.update({
        where: { id: params.id },
        data: { status: "CONCLUIDA", dataConclusao: new Date() },
      });

      await prisma.atividade.create({
        data: {
          tipo: "TAREFA_CONCLUIDA",
          descricao: `Tarefa "${tarefa.titulo}" concluída`,
          userId: payload.userId,
          tarefaId: params.id,
          clienteId: tarefa.clienteId,
          leadId: tarefa.leadId,
          oportunidadeId: tarefa.oportunidadeId,
        },
      });

      return NextResponse.json({ data: tarefa });
    }

    const data = tarefaSchema.parse(body);
    const tarefa = await prisma.tarefa.update({
      where: { id: params.id },
      data: {
        ...data,
        dataVencimento: new Date(data.dataVencimento),
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
      },
    });

    await createAuditLog({ userId: payload.userId, entidade: "Tarefa", entidadeId: params.id, acao: "UPDATE", dadosNovos: data });

    return NextResponse.json({ data: tarefa });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar tarefa" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "tarefas:delete");

    await prisma.tarefa.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Tarefa removida" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover tarefa" }, { status: 500 });
  }
}
