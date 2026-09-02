import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Conversas de WhatsApp vinculadas a um Cliente — usado na aba "WhatsApp" da
// ficha do cliente. Sem permissão de módulo, devolve lista vazia (a aba só
// não mostra nada, não quebra a página).
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const clienteId = request.nextUrl.searchParams.get("clienteId");
  if (!clienteId) return NextResponse.json([]);
  if (!hasPermission(payload.role, "whatsapp:use")) return NextResponse.json([]);

  const conversas = await prisma.whatsAppConversa.findMany({
    where: {
      clienteId,
      ...(isAdmin(payload.role) ? {} : { sessao: { atendenteId: payload.userId } }),
    },
    orderBy: { ultimaMsgEm: "desc" },
    select: {
      id: true,
      contatoPhone: true,
      contatoNome: true,
      status: true,
      naoLidas: true,
      ultimaMsgEm: true,
      tags: true,
      sessao: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      mensagens: { orderBy: { enviadaEm: "desc" }, take: 1, select: { conteudo: true, direcao: true } },
    },
  });

  return NextResponse.json(conversas);
}
