import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { contatoSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "contatos:read");

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const empresaId = searchParams.get("empresaId") || undefined;

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { cargo: { contains: search, mode: "insensitive" } },
      ];
    }
    if (empresaId) where.empresaId = empresaId;

    const [data, total] = await Promise.all([
      prisma.contato.findMany({
        where,
        include: { empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
        orderBy: [{ principal: "desc" }, { nome: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contato.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar contatos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "contatos:create");

    const body = await request.json();
    const data = contatoSchema.parse(body);

    const contato = await prisma.contato.create({ data });
    await createAuditLog({ userId: payload.userId, entidade: "Contato", entidadeId: contato.id, acao: "CREATE", dadosNovos: data });

    return NextResponse.json({ data: contato }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar contato" }, { status: 500 });
  }
}
