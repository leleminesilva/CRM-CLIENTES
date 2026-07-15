import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  role: z.enum(["ADMINISTRADOR", "DESENVOLVEDOR", "GESTOR", "COMERCIAL", "OPERACIONAL"]),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "usuarios:read");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const ativo = searchParams.get("ativo");

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (ativo !== null && ativo !== undefined) where.ativo = ativo === "true";

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, nome: true, email: true, role: true, avatar: true, ativo: true,
        createdAt: true, updatedAt: true,
        _count: { select: { clientes: true, leads: true, oportunidades: true } },
      },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({ data: users });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "usuarios:create");

    const body = await request.json();
    const data = createSchema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });

    const hashed = await bcrypt.hash(data.senha, 12);
    const user = await prisma.user.create({
      data: { ...data, senha: hashed },
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });

    await createAuditLog({ userId: payload.userId, entidade: "User", entidadeId: user.id, acao: "CREATE" });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
