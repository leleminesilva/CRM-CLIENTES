import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, canViewAll as canViewAllRole } from "@/lib/rbac";
import { createAuditLog, sanitizeForAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { type ClienteInput } from "@/lib/validators/cliente";
import type { EstagioLead, OrigemCliente, Temperatura } from "@prisma/client";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  temperatura: "Temperatura",
  statusOrcamento: "Status do orçamento",
  valorOrcamento: "Valor do orçamento",
  servicoBuscado: "Serviço buscado",
  observacoes: "Observações",
  origem: "Origem",
  numeroOrcamento: "Nº orçamento",
  responsavelId: "Responsável",
  dataVenda: "Data da venda",
};

const TEMP_LABELS: Record<string, string> = { QUENTE: "Quente", MORNO: "Morno", FRIO: "Frio" };
const STATUS_LABELS: Record<string, string> = { PENDENTE: "Pendente", APROVADO: "Aprovado", NAO_APROVADO: "Não aprovado" };

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "temperatura") return TEMP_LABELS[String(value)] ?? String(value);
  if (key === "statusOrcamento") return STATUS_LABELS[String(value)] ?? String(value);
  if (key === "valorOrcamento") return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  if (key === "responsavelId") return null as unknown as string; // tratado separado
  if (key === "dataVenda") {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("pt-BR");
  }
  return String(value);
}

function descricaoAlteracoes(
  old: Record<string, unknown>,
  novo: Record<string, unknown>,
  nomeCliente: string
): string {
  const changes: string[] = [];

  for (const key of Object.keys(FIELD_LABELS)) {
    if (!(key in novo)) continue;
    const oldVal = old[key];
    const newVal = novo[key];

    const oldStr = String(oldVal ?? "");
    const newStr = String(newVal ?? "");
    if (oldStr === newStr) continue;

    const label = FIELD_LABELS[key];

    if (key === "responsavelId") {
      changes.push("Responsável alterado");
      continue;
    }

    const oldFormatted = formatFieldValue(key, oldVal);
    const newFormatted = formatFieldValue(key, newVal);
    if (oldFormatted === newFormatted) continue;

    changes.push(`${label}: ${oldFormatted} → ${newFormatted}`);
  }

  return changes.length > 0 ? changes.join(" · ") : `Cliente ${nomeCliente} atualizado`;
}

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

    const canViewAll = canViewAllRole(payload.role);

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
        vendas: { where: { deletedAt: null }, orderBy: { data: "desc" } },
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

    const canViewAll = canViewAllRole(payload.role);
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

    // Determina orcamentoEnviadoEm: grava quando budget é definido pela primeira vez, limpa quando removido ou finalizado
    const statusFinal = rest.statusOrcamento === "APROVADO" || rest.statusOrcamento === "NAO_APROVADO";
    let orcamentoEnviadoEm: Date | null = old.orcamentoEnviadoEm ?? null;
    if (statusFinal || !valorOrcamento) {
      orcamentoEnviadoEm = null;
    } else if (valorOrcamento && !old.valorOrcamento) {
      orcamentoEnviadoEm = new Date();
    }

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...rest,
        dataInscricao: dataInscricao ? new Date(dataInscricao) : null,
        prazoOrcamento: prazoOrcamento ? new Date(prazoOrcamento) : null,
        valorOrcamento: valorOrcamento ?? null,
        orcamentoEnviadoEm,
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
        descricao: descricaoAlteracoes(
          old as unknown as Record<string, unknown>,
          data as unknown as Record<string, unknown>,
          cliente.nome
        ),
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

    const canViewAll = canViewAllRole(payload.role);
    const old = await prisma.cliente.findFirst({
      where: { id: params.id, deletedAt: null, ...(canViewAll ? {} : { responsavelId: payload.userId }) },
    });
    if (!old) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await request.json();

    // Constrói o objeto de update apenas com os campos presentes no body
    const updateData: Record<string, unknown> = {};
    if ("observacoes"          in body) updateData.observacoes     = body.observacoes     || null;
    if ("numeroOrcamento"      in body) updateData.numeroOrcamento = body.numeroOrcamento || null;
    if ("valorOrcamento"       in body) updateData.valorOrcamento  = body.valorOrcamento  ? Number(body.valorOrcamento) : null;
    if ("prazoOrcamento"       in body) updateData.prazoOrcamento  = body.prazoOrcamento  ? new Date(body.prazoOrcamento) : null;
    if ("dataVenda"            in body) updateData.dataVenda       = body.dataVenda        ? new Date(body.dataVenda) : null;
    if ("statusOrcamento"      in body) updateData.statusOrcamento = body.statusOrcamento;
    if ("temperatura"          in body) updateData.temperatura     = body.temperatura;
    // Quando enviado explicitamente (ex: dialog Primeiro Orçamento), usa a data do campo diretamente
    if ("orcamentoEnviadoEm"    in body) updateData.orcamentoEnviadoEm    = body.orcamentoEnviadoEm    ? new Date(`${body.orcamentoEnviadoEm}T12:00:00`)    : null;
    // Campos do Orçamento Final — salvos separadamente para não sobrescrever o Primeiro Orçamento
    if ("orcamentoFinalNumero"  in body) updateData.orcamentoFinalNumero  = body.orcamentoFinalNumero  || null;
    if ("orcamentoFinalValor"   in body) updateData.orcamentoFinalValor   = body.orcamentoFinalValor   ? Number(body.orcamentoFinalValor)                  : null;
    if ("orcamentoFinalEm"      in body) updateData.orcamentoFinalEm      = body.orcamentoFinalEm      ? new Date(`${body.orcamentoFinalEm}T12:00:00`)      : null;

    // Auto-gestão de orcamentoEnviadoEm quando não é enviado explicitamente
    if (!("orcamentoEnviadoEm" in body) && ("valorOrcamento" in body || "statusOrcamento" in body)) {
      const novoStatus = (updateData.statusOrcamento ?? old.statusOrcamento) as string;
      const novoValor = updateData.valorOrcamento as number | null;
      const statusFinal = novoStatus === "APROVADO" || novoStatus === "NAO_APROVADO";
      if (statusFinal || novoValor === null) {
        updateData.orcamentoEnviadoEm = null;
      } else if (novoValor && !old.valorOrcamento) {
        updateData.orcamentoEnviadoEm = new Date();
      }
    }

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: updateData,
    });

    // Sincroniza lead se statusOrcamento, valorOrcamento ou dataVenda foram alterados
    if ("statusOrcamento" in body || "valorOrcamento" in body || "dataVenda" in body) {
      const leadExistente = await prisma.lead.findFirst({ where: { clienteId: params.id, deletedAt: null } });
      const leadUpdate: Record<string, unknown> = {};

      // Atualiza valor estimado sempre que valorOrcamento é enviado
      if ("valorOrcamento" in body) {
        leadUpdate.valorEstimado = (updateData.valorOrcamento as number | null) ?? null;
      }

      // Só força estagio em casos de status final — nunca reseta o estagio do pipeline
      if ("statusOrcamento" in body) {
        const status = updateData.statusOrcamento as string;
        if (status === "APROVADO") {
          leadUpdate.estagio = "FECHADO_GANHO";
          // dataVenda tem precedência; se não vier neste body, mantém data existente ou usa now
          const dataVendaDate = updateData.dataVenda as Date | null | undefined;
          leadUpdate.dataFechamento = dataVendaDate ?? leadExistente?.dataFechamento ?? new Date();
        } else if (status === "NAO_APROVADO") {
          leadUpdate.estagio = "FECHADO_PERDIDO";
          leadUpdate.dataFechamento = leadExistente?.dataFechamento ?? new Date();
        } else {
          // PENDENTE: não sobrescreve estagio do pipeline, apenas limpa dataFechamento
          leadUpdate.dataFechamento = null;
        }
      }

      // Se dataVenda foi alterada e lead já está FECHADO_GANHO, sincroniza dataFechamento
      if ("dataVenda" in body && !("statusOrcamento" in body)) {
        const currentEstagio = leadExistente?.estagio;
        if (currentEstagio === "FECHADO_GANHO") {
          leadUpdate.dataFechamento = (updateData.dataVenda as Date | null) ?? leadExistente?.dataFechamento ?? new Date();
        }
      }

      if (Object.keys(leadUpdate).length > 0) {
        if (leadExistente) {
          await prisma.lead.update({ where: { id: leadExistente.id }, data: leadUpdate });
        } else {
          // Cria lead se não existe para que o valor apareça no dashboard
          const estagio: EstagioLead =
            updateData.statusOrcamento === "APROVADO" ? "FECHADO_GANHO" :
            updateData.statusOrcamento === "NAO_APROVADO" ? "FECHADO_PERDIDO" :
            updateData.valorOrcamento ? "PROPOSTA_ENVIADA" : "NOVO_LEAD";
          await prisma.lead.create({
            data: {
              titulo: old.nome,
              estagio,
              temperatura: (old.temperatura as Temperatura) ?? "MORNO",
              origem: (old.origem as OrigemCliente) ?? "OUTROS",
              responsavelId: old.responsavelId ?? payload.userId,
              clienteId: params.id,
              valorEstimado: (updateData.valorOrcamento as number | null) ?? undefined,
              dataFechamento: (estagio === "FECHADO_GANHO" || estagio === "FECHADO_PERDIDO") ? new Date() : undefined,
              ordemKanban: 0,
            },
          });
        }
      }
    }

    await prisma.atividade.create({
      data: {
        tipo: "EDICAO",
        descricao: descricaoAlteracoes(
          old as unknown as Record<string, unknown>,
          updateData,
          cliente.nome
        ),
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

    const body = await request.json().catch(() => ({}));
    const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
    if (!motivo) {
      return NextResponse.json({ error: "Informe o motivo da exclusão" }, { status: 400 });
    }

    const agora = new Date();

    await prisma.cliente.update({
      where: { id: params.id },
      data: { deletedAt: agora, motivoExclusao: motivo },
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
      dadosNovos: { motivo },
    });

    return NextResponse.json({ message: "Cliente removido com sucesso" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover cliente" }, { status: 500 });
  }
}
