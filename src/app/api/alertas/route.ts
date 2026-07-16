import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const gerenciamento = searchParams.get("gerenciamento") === "true";

    if (gerenciamento) {
      if (!isAdmin(payload.role)) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }

      // Histórico de alertas para gerenciamento dos admins
      const alertas = await prisma.alerta.findMany({
        include: {
          destinoUser: { select: { id: true, nome: true } },
          criador: { select: { id: true, nome: true } },
          _count: { select: { leituras: true } },
        },
        orderBy: { criadoEm: "desc" },
      });

      return NextResponse.json({ data: alertas });
    }

    // Alertas não lidos destinados ao usuário logado (individuais ou coletivos)
    const alertas = await prisma.alerta.findMany({
      where: {
        OR: [
          { destinoUserId: payload.userId },
          { destinoUserId: null },
        ],
        leituras: {
          none: {
            userId: payload.userId,
          },
        },
      },
      include: {
        criador: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    return NextResponse.json({ data: alertas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar alertas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!isAdmin(payload.role)) {
      return NextResponse.json({ error: "Apenas administradores podem criar alertas" }, { status: 403 });
    }

    const { titulo, mensagem, destinoUserId } = await request.json();

    if (!titulo?.trim() || !mensagem?.trim()) {
      return NextResponse.json({ error: "Título e mensagem são obrigatórios" }, { status: 400 });
    }

    const alerta = await prisma.alerta.create({
      data: {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        destinoUserId: destinoUserId || null,
        criadorId: payload.userId,
      },
    });

    return NextResponse.json({ data: alerta }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar alerta" }, { status: 500 });
  }
}
