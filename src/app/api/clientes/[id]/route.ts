import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { clienteSchema, orcamentoSchema } from "@/lib/validators/cliente";
import type { EstagioLead, OrigemCliente, Temperatura } from "@prisma/client";

export const dynamic = "force-dynamic";

function mapStatusToEstagio(
  statusOrcamento: string,
  valorOrcamento?: number | null
): EstagioLead {
  if (statusOrcamento === "APROVADO") return "FECHADO_GANHO";
  if (statusOrcamento === "NAO_APROVADO") return "FECHADO_PERDIDO";
  if (valorOrcamento) return "PROPOSTA_ENVIADA";
  return "NOVO_LEAD";
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const canViewAll = payload.role === "ADMINISTRADOR" || payload.role === "GESTOR";

    const cliente = await prisma.cliente.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
        ...(canViewAll ? {} : { responsavelId: payload.userId }),
      },
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true, email: true } },
        empresa: true,
        contato: true,
        atividades: {
          include: { user: { select: { id: true, nome: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        comentarios: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, nome: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        },
        anexos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        leads: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 },
        oportunidades: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 },
        tarefas: { where: { deletedAt: null }, orderBy: { dataVencimento: "asc" }, take: 5 },
      },
    });

    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    return NextResponse.json({ data: cliente });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:update");

    const canViewAll = payload.role === "ADMINISTRADOR" || payload.role === "GESTOR";
    const old = await prisma.cliente.findFirst({
      where: { id: params.id, deletedAt: null, ...(canViewAll ? {} : { responsavelId: payload.userId }) },
    });
    if (!old) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await request.json();
    const data = clienteSchema.parse(body);

    const { dataInscricao, prazoOrcamento, valorOrcamento, ...rest } = data;

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...rest,
        dataInscricao: dataInscricao ? new Date(dataInscricao) : null,
        prazoOrcamento: prazoOrcamento ? new Date(prazoOrcamento) : null,
        valorOrcamento: valorOrcamento ?? null,
      },
    });

    // Sincroniza Lead vinculado ao cliente (cria se não existir)
    const leadExistente = await prisma.lead.findFirst({
      where: { clienteId: params.id, deletedAt: null },
    });
    const novoEstagioPut = mapStatusToEstagio(rest.statusOrcamento ?? "PENDENTE", valorOrcamento);
    const isFechadoPut = novoEstagioPut === "FECHADO_GANHO" || novoEstagioPut === "FECHADO_PERDIDO";
    const tituloLead = `${cliente.nome}${rest.servicoBuscado ? ` — ${rest.servicoBuscado}` : ""}`;
    if (leadExistente) {
      await prisma.lead.update({
        where: { id: leadExistente.id },
        data: {
          titulo: tituloLead,
          estagio: novoEstagioPut,
          temperatura: rest.temperatura ?? leadExistente.temperatura,
          responsavelId: rest.responsavelId ?? leadExistente.responsavelId,
          valorEstimado: valorOrcamento ?? null,
          dataFechamento: isFechadoPut ? (leadExistente.dataFechamento ?? new Date()) : null,
        },
      });
    } else {
      await prisma.lead.create({
        data: {
          titulo: tituloLead,
          estagio: novoEstagioPut,
          temperatura: (rest.temperatura as Temperatura) ?? "MORNO",
          origem: (rest.origem as OrigemCliente) ?? "OUTROS",
          responsavelId: rest.responsavelId ?? old.responsavelId ?? payload.userId,
          clienteId: params.id,
          valorEstimado: valorOrcamento ?? undefined,
          dataFechamento: isFechadoPut ? new Date() : undefined,
          ordemKanban: 0,
        },
      });
    }

    await createAuditLog({
      userId: payload.userId,
      entidade: "Cliente",
      entidadeId: params.id,
      acao: "UPDATE",
      dadosAntigos: sanitizeForAudit(old as unknown as Record<string, unknown>),
      dadosNovos: sanitizeForAudit(data as unknown as Record<string, unknown>),
    });

    await prisma.atividade.create({
      data: {
        tipo: "EDICAO",
        descricao: `Cliente ${cliente.nome} atualizado`,
        userId: payload.userId,
        clienteId: params.id,
      },
    });

    return NextResponse.json({ data: cliente });
  } catch (err) {
    console.error("PUT /clientes/[id]", err);
    const msg = err instanceof Error ? err.message : "Erro ao atualizar cliente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Atualização parcial: apenas Etapas 2+3 (orçamento + acompanhamento)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:update");

    const canViewAll = payload.role === "ADMINISTRADOR" || payload.role === "GESTOR";
    const old = await prisma.cliente.findFirst({
      where: { id: params.id, deletedAt: null, ...(canViewAll ? {} : { responsavelId: payload.userId }) },
    });
    if (!old) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await request.json();
    const data = orcamentoSchema.parse(body);

    const { prazoOrcamento, valorOrcamento, ...rest } = data;

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...rest,
        prazoOrcamento: prazoOrcamento ? new Date(prazoOrcamento) : null,
        valorOrcamento: valorOrcamento ?? null,
      },
    });

    // Sincroniza Lead vinculado ao cliente (cria se não existir)
    const leadExistentePatch = await prisma.lead.findFirst({
      where: { clienteId: params.id, deletedAt: null },
    });
    const novoEstagioPatch = mapStatusToEstagio(rest.statusOrcamento ?? "PENDENTE", valorOrcamento);
    const isFechadoPatch = novoEstagioPatch === "FECHADO_GANHO" || novoEstagioPatch === "FECHADO_PERDIDO";
    if (leadExistentePatch) {
      await prisma.lead.update({
        where: { id: leadExistentePatch.id },
        data: {
          estagio: novoEstagioPatch,
          temperatura: rest.temperatura ?? leadExistentePatch.temperatura,
          valorEstimado: valorOrcamento ?? null,
          dataFechamento: isFechadoPatch ? (leadExistentePatch.dataFechamento ?? new Date()) : null,
        },
      });
    } else {
      // Cliente não tinha lead (criado antes da funcionalidade) — cria agora
      await prisma.lead.create({
        data: {
          titulo: `${old.nome}${old.servicoBuscado ? ` — ${old.servicoBuscado}` : ""}`,
          estagio: novoEstagioPatch,
          temperatura: (rest.temperatura as Temperatura) ?? (old.temperatura as Temperatura) ?? "MORNO",
          origem: (old.origem as OrigemCliente) ?? "OUTROS",
          responsavelId: old.responsavelId ?? payload.userId,
          clienteId: params.id,
          valorEstimado: valorOrcamento ?? undefined,
          dataFechamento: isFechadoPatch ? new Date() : undefined,
          ordemKanban: 0,
        },
      });
    }

    await prisma.atividade.create({
      data: {
        tipo: "EDICAO",
        descricao: `Orçamento do cliente ${cliente.nome} atualizado`,
        userId: payload.userId,
        clienteId: params.id,
      },
    });

    return NextResponse.json({ data: cliente });
  } catch (error) {
    console.error("PATCH /clientes/[id]", error);
    return NextResponse.json({ error: "Erro ao atualizar orçamento" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:delete");

    await prisma.cliente.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: payload.userId,
      entidade: "Cliente",
      entidadeId: params.id,
      acao: "DELETE",
    });

    return NextResponse.json({ message: "Cliente removido com sucesso" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover cliente" }, { status: 500 });
  }
}
