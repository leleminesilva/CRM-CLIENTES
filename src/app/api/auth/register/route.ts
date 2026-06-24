import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  role: z.enum(["ADMINISTRADOR", "GESTOR", "COMERCIAL", "OPERACIONAL"]),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    requirePermission(payload.role, "usuarios:create");

    const body = await request.json();
    const data = schema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(data.senha, 12);
    const user = await prisma.user.create({
      data: { ...data, senha: hashed },
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
