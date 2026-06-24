import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "auditoria:view");

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const entidade = searchParams.get("entidade") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const de = searchParams.get("de") || undefined;
    const ate = searchParams.get("ate") || undefined;

    const where: Record<string, unknown> = {};
    if (entidade) where.entidade = entidade;
    if (userId) where.userId = userId;
    if (de || ate) {
      where.createdAt = {};
      if (de) (where.createdAt as Record<string, unknown>).gte = new Date(de);
      if (ate) (where.createdAt as Record<string, unknown>).lte = new Date(ate);
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, nome: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar auditoria" }, { status: 500 });
  }
}
