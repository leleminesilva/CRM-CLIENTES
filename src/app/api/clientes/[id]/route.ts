import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { type ClienteInput } from "@/lib/validators/cliente";
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

    // Aceita qualquer dado — sem rejeição por campos faltantes ou inválidos
    const nu = (v: unknown) => (v === null || v === "" ? undefined : v);
    const data: ClienteInput = {
      nome:              String(body.nome || ""),
      razaoSocial:       nu(body.razaoSocial)  as string | undefined,
      nomeFantasia:      nu(body.nomeFantasia) as string | undefined,
      cpfCnpj:           nu(body.cpfCnpj)      as string | undefined,
      telefone:          nu(body.telefone)      as string | undefined,
      whatsapp:          nu(body.whatsapp)      as string | undefined,
      email:             nu(body.email)         as string | undefined,
      cep:               nu(body.cep)           as string | undefined,
      logradouro:        nu(body.logradouro)    as string | undefined,
      numero:            nu(body.numero)        as string | undefined,
      complemento:       nu(body.complemento)   as string | undefined,
      tipoResidencia:    nu(body.tipoResidencia) as ClienteInput["tipoResidencia"],
      bairro:            nu(body.bairro)        as string | undefined,
      cidade:            nu(body.cidade)        as string | undefined,
      estado:            nu(body.estado)        as string | undefined,
      segmento:          nu(body.segmento)      as string | undefined,
      porte:             nu(body.porte)         as ClienteInput["porte"],
      origem:            body.origem            || "OUTROS",
      responsavelId:     nu(body.responsavelId) as string | undefined,
      empresaId:         nu(body.empresaId)     as string | undefined,
      contatoId:         nu(body.contatoId)     as string | undefined,
      observacoes:       nu(body.observacoes)   as string | undefined,
      dataInscricao:     nu(body.dataInscricao) as string | undefined,
      servicoBuscado:    nu(body.servicoBuscado) as string | undefined,
      numeroOrcamento:   nu(body.numeroOrcamento) as string | undefined,
      valorOrcamento:    body.valorOrcamento ? Number(body.valorOrcamento) : undefined,
      prazoOrcamento:    nu(body.prazoOrcamento) as string | undefined,
      statusOrcamento:   body.statusOrcamento   || "PENDENTE",
      temperatura:       body.temperatura       || "MORNO",
    };

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

// Atualização parcial — só atualiza os campos enviados no body
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

    // Constrói o objeto de update apenas com os campos presentes no body
    const updateData: Record<string, unknown> = {};
    if ("observacoes"     in body) updateData.observacoes     = body.observacoes     || null;
    if ("numeroOrcamento" in body) updateData.numeroOrcamento = body.numeroOrcamento || null;
    if ("valorOrcamento"  in body) updateData.valorOrcamento  = body.valorOrcamento  ? Number(body.valorOrcamento) : null;
    if ("prazoOrcamento"  in body) updateData.prazoOrcamento  = body.prazoOrcamento  ? new Date(body.prazoOrcamento) : null;
    if ("statusOrcamento" in body) updateData.statusOrcamento = body.statusOrcamento;
    if ("temperatura"     in body) updateData.temperatura     = body.temperatura;

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: updateData,
    });

    // Sincroniza lead se statusOrcamento ou valorOrcamento foram alterados
    if ("statusOrcamento" in body || "valorOrcamento" in body) {
      const leadExistente = await prisma.lead.findFirst({ where: { clienteId: params.id, deletedAt: null } });
      const novoEstagio = mapStatusToEstagio(
        (updateData.statusOrcamento as string) ?? old.statusOrcamento ?? "PENDENTE",
        updateData.valorOrcamento as number | undefined
      );
      const isFechado = novoEstagio === "FECHADO_GANHO" || novoEstagio === "FECHADO_PERDIDO";
      if (leadExistente) {
        await prisma.lead.update({
          where: { id: leadExistente.id },
          data: {
            estagio: novoEstagio,
            valorEstimado: (updateData.valorOrcamento as number | null) ?? null,
            dataFechamento: isFechado ? (leadExistente.dataFechamento ?? new Date()) : null,
          },
        });
      }
    }

    await prisma.atividade.create({
      data: {
        tipo: "EDICAO",
        descricao: `Cliente ${cliente.nome} atualizado`,
        userId: payload.userId,
        clienteId: params.id,
      },
    });

    return NextResponse.json({ data: cliente });
  } catch (error) {
    console.error("PATCH /clientes/[id]", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:delete");

    const agora = new Date();

    await prisma.cliente.update({
      where: { id: params.id },
      data: { deletedAt: agora },
    });

    // Remove todos os leads e oportunidades vinculados para não distorcer o dashboard
    await prisma.lead.updateMany({
      where: { clienteId: params.id, deletedAt: null },
      data: { deletedAt: agora },
    });

    await prisma.oportunidade.updateMany({
      where: { clienteId: params.id, deletedAt: null },
      data: { deletedAt: agora },
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
