import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { signedUrlMedia } from "@/lib/whatsapp/media";
import { waLogger } from "@/lib/whatsapp/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const conversa = await prisma.whatsAppConversa.findUnique({
    where: { id: params.id },
    select: { sessao: { select: { atendenteId: true } } },
  });
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  if (!isAdmin(payload.role) && conversa.sessao.atendenteId !== payload.userId) {
    return NextResponse.json({ error: "Você não tem acesso a esta conversa" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;

  const [mensagensRaw, total] = await Promise.all([
    prisma.whatsAppMensagem.findMany({
      where: { conversaId: params.id },
      orderBy: { enviadaEm: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whatsAppMensagem.count({ where: { conversaId: params.id } }),
  ]);

  // mediaUrl no banco é um caminho no bucket privado, não uma URL — vira URL
  // assinada (curta duração) só na hora de servir ao frontend. Ver
  // src/lib/whatsapp/media.ts e docs/architecture/whatsapp.md.
  const mensagens = await Promise.all(
    mensagensRaw.map(async (m) => {
      if (!m.mediaUrl) return m;
      try {
        return { ...m, mediaUrl: await signedUrlMedia(m.mediaUrl, "leitura") };
      } catch (err) {
        waLogger.error("falha ao assinar URL de mídia", { erro: err, conversationId: params.id });
        return { ...m, mediaUrl: null };
      }
    })
  );

  // Zera contador de não lidas ao abrir a conversa
  await prisma.whatsAppConversa.update({
    where: { id: params.id },
    data: { naoLidas: 0 },
  });

  return NextResponse.json({ mensagens, total, page, totalPages: Math.ceil(total / limit) });
}
