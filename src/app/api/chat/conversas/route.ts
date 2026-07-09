import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Resumo do chat pro usuário logado: não lidas do canal geral + lista de conversas
// privadas já iniciadas (com a última mensagem e quantas não lidas em cada uma).
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const leitura = await prisma.chatLeitura.findUnique({ where: { userId: payload.userId } });

  const naoLidasGeral = await prisma.chatMensagem.count({
    where: {
      destinatarioId: null,
      deletedAt: null,
      autorId: { not: payload.userId },
      createdAt: { gt: leitura?.ultimaGeral ?? new Date(0) },
    },
  });

  const mensagensDm = await prisma.chatMensagem.findMany({
    where: {
      deletedAt: null,
      destinatarioId: { not: null },
      OR: [{ autorId: payload.userId }, { destinatarioId: payload.userId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      autor: { select: { id: true, nome: true, avatar: true } },
      destinatario: { select: { id: true, nome: true, avatar: true } },
    },
  });

  const conversasPorUsuario = new Map<
    string,
    { usuario: { id: string; nome: string; avatar: string | null }; ultimaMensagem: typeof mensagensDm[number]; naoLidas: number }
  >();

  for (const msg of mensagensDm) {
    const outraPessoa = msg.autorId === payload.userId ? msg.destinatario! : msg.autor;
    const existente = conversasPorUsuario.get(outraPessoa.id);
    if (!existente) {
      conversasPorUsuario.set(outraPessoa.id, { usuario: outraPessoa, ultimaMensagem: msg, naoLidas: 0 });
    }
    if (msg.destinatarioId === payload.userId && !msg.lida) {
      conversasPorUsuario.get(outraPessoa.id)!.naoLidas += 1;
    }
  }

  const conversas = Array.from(conversasPorUsuario.values())
    .sort((a, b) => new Date(b.ultimaMensagem.createdAt).getTime() - new Date(a.ultimaMensagem.createdAt).getTime())
    .map((c) => ({
      usuario: c.usuario,
      naoLidas: c.naoLidas,
      ultimaMensagem: {
        conteudo: c.ultimaMensagem.conteudo,
        autorId: c.ultimaMensagem.autorId,
        createdAt: c.ultimaMensagem.createdAt,
      },
    }));

  return NextResponse.json({
    naoLidasGeral,
    totalNaoLidas: naoLidasGeral + conversas.reduce((soma, c) => soma + c.naoLidas, 0),
    conversas,
  });
}
