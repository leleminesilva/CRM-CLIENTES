import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;

  const [mensagens, total] = await Promise.all([
    prisma.whatsAppMensagem.findMany({
      where: { conversaId: params.id },
      orderBy: { enviadaEm: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whatsAppMensagem.count({ where: { conversaId: params.id } }),
  ]);

  // Zera contador de não lidas ao abrir a conversa
  await prisma.whatsAppConversa.update({
    where: { id: params.id },
    data: { naoLidas: 0 },
  });

  return NextResponse.json({ mensagens, total, page, totalPages: Math.ceil(total / limit) });
}
