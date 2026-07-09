import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, buildWhereClause } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { tarefaSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "tarefas:read");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const tipo = searchParams.get("tipo") || undefined;
    const de = searchParams.get("de") || undefined;
    const ate = searchParams.get("ate") || undefined;

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...buildWhereClause(payload.role, payload.userId),
    };

    if (status) where.status = status;
    if (tipo) where.tipo = tipo;
    if (de || ate) {
      where.dataVencimento = {};
      if (de) (where.dataVencimento as Record<string, unknown>).gte = new Date(de);
      if (ate) (where.dataVencimento as Record<string, unknown>).lte = new Date(ate);
    }

    const tarefas = await prisma.tarefa.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true } },
        cliente: { select: { id: true, nome: true } },
        lead: { select: { id: true, titulo: true } },
        oportunidade: { select: { id: true, titulo: true } },
      },
      orderBy: [{ prioridade: "asc" }, { dataVencimento: "asc" }],
    });

    return NextResponse.json({ data: tarefas });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar tarefas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "tarefas:create");

    const body = await request.json();
    const { responsavelIds, paraTodos, ...resto } = body as {
      responsavelIds?: string[];
      paraTodos?: boolean;
      [key: string]: unknown;
    };
    const data = tarefaSchema.parse(resto);

    // Atribuição compartilhada: cria uma cópia independente da tarefa por pessoa selecionada
    // (ou por todos os usuários ativos), cada uma concluível separadamente.
    let idsAlvo: string[];
    if (paraTodos) {
      const todos = await prisma.user.findMany({
        where: { ativo: true, deletedAt: null },
        select: { id: true },
      });
      idsAlvo = todos.map((u) => u.id);
    } else if (Array.isArray(responsavelIds) && responsavelIds.length > 0) {
      idsAlvo = responsavelIds;
    } else {
      idsAlvo = [data.responsavelId || payload.userId];
    }

    const tarefas = await prisma.$transaction(
      idsAlvo.map((responsavelId) =>
        prisma.tarefa.create({
          data: {
            ...data,
            horario: data.horario || null,
            dataVencimento: new Date(data.dataVencimento),
            dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
            responsavelId,
          },
        })
      )
    );

    for (const tarefa of tarefas) {
      await createAuditLog({ userId: payload.userId, entidade: "Tarefa", entidadeId: tarefa.id, acao: "CREATE", dadosNovos: data });
      await prisma.atividade.create({
        data: {
          tipo: "TAREFA_CRIADA",
          descricao: `Tarefa "${tarefa.titulo}" criada`,
          userId: payload.userId,
          clienteId: tarefa.clienteId,
          leadId: tarefa.leadId,
          oportunidadeId: tarefa.oportunidadeId,
          tarefaId: tarefa.id,
        },
      });
    }

    return NextResponse.json({ data: tarefas }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar tarefa" }, { status: 500 });
  }
}
