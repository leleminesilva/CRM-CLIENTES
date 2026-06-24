import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validators/usuario";
import { signToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, senha } = loginSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, ativo: true },
    });

    if (!user || !await bcrypt.compare(senha, user.senha)) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      );
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      data: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        ativo: user.ativo,
        token,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
