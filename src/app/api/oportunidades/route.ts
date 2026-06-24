import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, buildWhereClause } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { oportunidadeSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "oportunidades:read");

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...buildWhereClause(payload.role, payload.userId),
    };

    if (status) where.status = status;
    if (search) {
      where.OR = [{ titulo: { contains: search, mode: "insensitive" } }];
    }

    const [data, total] = await Promise.all([
      prisma.oportunidade.findMany({
        where,
        include: {
          responsavel: { select: { id: true, nome: true, avatar: true } },
          cliente: { select: { id: true, nome: true } },
          empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.oportunidade.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar oportunidades" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "oportunidades:create");

    const body = await request.json();
    const data = oportunidadeSchema.parse(body);

    const oportunidade = await prisma.oportunidade.create({
      data: { ...data, responsavelId: data.responsavelId || payload.userId },
    });

    await createAuditLog({ userId: payload.userId, entidade: "Oportunidade", entidadeId: oportunidade.id, acao: "CREATE", dadosNovos: data });
    await prisma.atividade.create({
      data: { tipo: "CRIACAO", descricao: `Oportunidade "${oportunidade.titulo}" criada`, userId: payload.userId, oportunidadeId: oportunidade.id },
    });

    return NextResponse.json({ data: oportunidade }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar oportunidade" }, { status: 500 });
  }
}
