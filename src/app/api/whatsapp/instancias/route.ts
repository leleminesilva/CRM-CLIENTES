import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const instancias = await prisma.whatsAppInstancia.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { conversas: true } },
    },
  });

  return NextResponse.json(instancias);
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!["ADMINISTRADOR", "DESENVOLVEDOR", "GESTOR"].includes(payload.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { nome, phoneNumberId, accessToken, phoneNumber } = body;

  if (!nome || !phoneNumberId || !accessToken) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const instancia = await prisma.whatsAppInstancia.create({
    data: { nome, phoneNumberId, accessToken, phoneNumber },
  });

  return NextResponse.json(instancia, { status: 201 });
}
