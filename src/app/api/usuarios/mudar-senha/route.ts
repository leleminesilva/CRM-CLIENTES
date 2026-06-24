import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const { senhaAtual, novaSenha } = schema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { senha: true },
    });

    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const senhaCorreta = await bcrypt.compare(senhaAtual, user.senha);
    if (!senhaCorreta) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);
    await prisma.user.update({
      where: { id: payload.userId },
      data: { senha: novaSenhaHash },
    });

    return NextResponse.json({ message: "Senha alterada com sucesso" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao alterar senha" }, { status: 500 });
  }
}
