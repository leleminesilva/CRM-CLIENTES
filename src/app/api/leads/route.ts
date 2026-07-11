import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, buildWhereClause } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { leadSchema } from "@/lib/validators/lead";
import { promoverLeadsParaReengajar } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "leads:read");

    await promoverLeadsParaReengajar();

    const { searchParams } = new URL(request.url);
    const estagio = searchParams.get("estagio") || undefined;
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...buildWhereClause(payload.role, payload.userId),
    };

    if (estagio) where.estagio = estagio;
    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true } },
        cliente: { select: { id: true, nome: true } },
        empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        contato: { select: { id: true, nome: true } },
      },
      orderBy: [{ estagio: "asc" }, { ordemKanban: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: leads });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar leads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "leads:create");

    const body = await request.json();
    const data = leadSchema.parse(body);

    const lead = await prisma.lead.create({
      data: {
        ...data,
        valorEstimado: data.valorEstimado ?? null,
        responsavelId: data.responsavelId || payload.userId,
      },
    });

    await createAuditLog({
      userId: payload.userId,
      entidade: "Lead",
      entidadeId: lead.id,
      acao: "CREATE",
      dadosNovos: data,
    });

    await prisma.atividade.create({
      data: {
        tipo: "CRIACAO",
        descricao: `Lead "${lead.titulo}" criado`,
        userId: payload.userId,
        leadId: lead.id,
        clienteId: lead.clienteId,
      },
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar lead" }, { status: 500 });
  }
}
