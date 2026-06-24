import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { empresaSchema } from "@/lib/validators/oportunidade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "empresas:read");

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { razaoSocial: { contains: search, mode: "insensitive" } },
        { nomeFantasia: { contains: search, mode: "insensitive" } },
        { cnpj: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.empresa.findMany({
        where,
        include: { _count: { select: { contatos: true, clientes: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.empresa.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar empresas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "empresas:create");

    const body = await request.json();
    const data = empresaSchema.parse(body);

    const empresa = await prisma.empresa.create({ data });
    await createAuditLog({ userId: payload.userId, entidade: "Empresa", entidadeId: empresa.id, acao: "CREATE", dadosNovos: data });

    return NextResponse.json({ data: empresa }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar empresa" }, { status: 500 });
  }
}
