import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessaoId = searchParams.get("sessaoId");

  const conversas = await prisma.whatsAppConversa.findMany({
    where: sessaoId ? { sessaoId } : undefined,
    orderBy: { ultimaMsgEm: "desc" },
    include: {
      mensagens: {
        orderBy: { enviadaEm: "desc" },
        take: 1,
      },
      agentEstado: { select: { estado: true } },
    },
  });

  return NextResponse.json(conversas);
}
