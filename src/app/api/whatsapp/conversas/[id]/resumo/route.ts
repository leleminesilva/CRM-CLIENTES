import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { resumirConversa } from "@/lib/whatsapp/resumo";
import { waLogger } from "@/lib/whatsapp/logger";

export const dynamic = "force-dynamic";

// Resumo da IA: devolve tópicos curtos sobre a conversa. Gerado sob demanda,
// não persiste. Não envia nada pro cliente.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const conversa = await prisma.whatsAppConversa.findUnique({
    where: { id: params.id },
    include: { sessao: { select: { atendenteId: true } } },
  });
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  if (!isAdmin(payload.role) && conversa.sessao.atendenteId !== payload.userId) {
    return NextResponse.json({ error: "Você não tem acesso a esta conversa" }, { status: 403 });
  }

  try {
    const resumo = await resumirConversa(params.id);
    return NextResponse.json(resumo);
  } catch (err) {
    waLogger.error("falha ao resumir conversa", { erro: err, conversationId: params.id });
    return NextResponse.json({ error: "Não foi possível gerar o resumo agora" }, { status: 502 });
  }
}
