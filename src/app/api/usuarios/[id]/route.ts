import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, isAdmin } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMINISTRADOR", "GESTOR", "COMERCIAL", "OPERACIONAL"]).optional(),
  ativo: z.boolean().optional(),
  senha: z.string().min(6).optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    if (payload.userId !== params.id) requirePermission(payload.role, "usuarios:read");

    const user = await prisma.user.findFirst({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true, nome: true, email: true, role: true, avatar: true, ativo: true,
        createdAt: true, updatedAt: true,
        _count: { select: { clientes: true, leads: true, oportunidades: true, tarefas: true } },
      },
    });

    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    return NextResponse.json({ data: user });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    if (payload.userId !== params.id) requirePermission(payload.role, "usuarios:update");

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.role && !isAdmin(payload.role)) {
      return NextResponse.json({ error: "Apenas administradores podem alterar roles" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 12);
    }
    delete updateData.senha;
    if (data.senha) updateData.senha = await bcrypt.hash(data.senha, 12);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });

    await createAuditLog({ userId: payload.userId, entidade: "User", entidadeId: params.id, acao: "UPDATE" });

    return NextResponse.json({ data: user });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "usuarios:delete");

    if (payload.userId === params.id) {
      return NextResponse.json({ error: "Não é possível desativar seu próprio usuário" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: params.id }, data: { deletedAt: new Date(), ativo: false } });
    await createAuditLog({ userId: payload.userId, entidade: "User", entidadeId: params.id, acao: "DELETE" });

    return NextResponse.json({ message: "Usuário desativado" });
  } catch {
    return NextResponse.json({ error: "Erro ao desativar usuário" }, { status: 500 });
  }
}
