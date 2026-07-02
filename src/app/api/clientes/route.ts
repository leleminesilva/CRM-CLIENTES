import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { clienteSchema } from "@/lib/validators/cliente";
import type { EstagioLead, OrigemCliente, Temperatura } from "@prisma/client";

export const dynamic = "force-dynamic";

// Mapeia o status do orçamento para o estágio do Lead no Kanban
function mapStatusToEstagio(
  statusOrcamento: string,
  valorOrcamento?: number | null
): EstagioLead {
  if (statusOrcamento === "APROVADO") return "FECHADO_GANHO";
  if (statusOrcamento === "NAO_APROVADO") return "FECHADO_PERDIDO";
  if (valorOrcamento) return "PROPOSTA_ENVIADA";
  return "NOVO_LEAD";
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:read");

    const canViewAll = payload.role === "ADMINISTRADOR" || payload.role === "GESTOR";

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const origem = searchParams.get("origem") || undefined;
    const responsavelIdParam = searchParams.get("responsavelId") || undefined;
    const temperatura = searchParams.get("temperatura") || undefined;
    const servico = searchParams.get("servico") || undefined;
    const estagio = searchParams.get("estagio") || undefined;
    const dataInicio = searchParams.get("dataInicio") || undefined;
    const dataFim = searchParams.get("dataFim") || undefined;
    const sort = searchParams.get("sort") || undefined;

    const andConditions: Record<string, unknown>[] = [];

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(canViewAll ? {} : { responsavelId: payload.userId }),
    };

    if (search) {
      andConditions.push({
        OR: [
          { nome: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { cpfCnpj: { contains: search } },
        ],
      });
    }
    if (origem) where.origem = origem;
    if (canViewAll && responsavelIdParam) where.responsavelId = responsavelIdParam;
    if (temperatura) where.temperatura = temperatura;
    if (servico) where.servicoBuscado = { contains: servico, mode: "insensitive" };
    if (estagio) where.leads = { some: { estagio, deletedAt: null } };
    if (dataInicio || dataFim) {
      const limite2d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const rangeFilter = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(`${dataFim}T23:59:59.999Z`) } : {}),
      };
      // Inclui clientes do período OU clientes parados há 2+ dias (não fechados)
      andConditions.push({
        OR: [
          { createdAt: rangeFilter },
          {
            updatedAt: { lt: limite2d },
            revisadoEm: null,
            statusOrcamento: { notIn: ["APROVADO", "NAO_APROVADO"] },
            leads: { none: { estagio: { in: ["FECHADO_GANHO", "FECHADO_PERDIDO"] }, deletedAt: null } },
          },
          {
            updatedAt: { lt: limite2d },
            revisadoEm: { lt: limite2d },
            statusOrcamento: { notIn: ["APROVADO", "NAO_APROVADO"] },
            leads: { none: { estagio: { in: ["FECHADO_GANHO", "FECHADO_PERDIDO"] }, deletedAt: null } },
          },
        ],
      });
    }

    if (andConditions.length > 0) where.AND = andConditions;

    const [data, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        include: {
          responsavel: { select: { id: true, nome: true, avatar: true } },
          empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          leads: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { estagio: true },
          },
        },
        orderBy: sort === "createdAt_asc"
          ? { createdAt: "asc" as const }
          : sort === "createdAt_desc"
          ? { createdAt: "desc" as const }
          : { updatedAt: "desc" as const },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cliente.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar clientes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:create");

    const body = await request.json();
    const data = clienteSchema.parse(body);

    const { dataInscricao, prazoOrcamento, valorOrcamento, ...rest } = data;

    const responsavelId = rest.responsavelId || payload.userId;

    const cliente = await prisma.cliente.create({
      data: {
        ...rest,
        responsavelId,
        dataInscricao: dataInscricao ? new Date(dataInscricao) : undefined,
        prazoOrcamento: prazoOrcamento ? new Date(prazoOrcamento) : undefined,
        valorOrcamento: valorOrcamento ?? undefined,
      },
    });

    // Cria Lead automaticamente vinculado ao cliente
    await prisma.lead.create({
      data: {
        titulo: `${cliente.nome}${rest.servicoBuscado ? ` — ${rest.servicoBuscado}` : ""}`,
        estagio: mapStatusToEstagio(rest.statusOrcamento ?? "PENDENTE", valorOrcamento),
        temperatura: (rest.temperatura as Temperatura) ?? "MORNO",
        origem: (rest.origem as OrigemCliente) ?? "OUTROS",
        responsavelId,
        clienteId: cliente.id,
        valorEstimado: valorOrcamento ?? undefined,
        ordemKanban: 0,
      },
    });

    await createAuditLog({ userId: payload.userId, entidade: "Cliente", entidadeId: cliente.id, acao: "CREATE", dadosNovos: data });
    await prisma.atividade.create({
      data: { tipo: "CRIACAO", descricao: `Cliente ${cliente.nome} criado`, userId: payload.userId, clienteId: cliente.id },
    });

    return NextResponse.json({ data: cliente }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
  }
}
