import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { transcreverAudio, TranscricaoIndisponivelError } from "@/lib/whatsapp/transcrever";
import { waLogger } from "@/lib/whatsapp/logger";

export const dynamic = "force-dynamic";

// Transcrição de um áudio pela IA (Whisper). Sob demanda, não persiste.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; msgId: string } },
) {
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
    const transcricao = await transcreverAudio(params.id, params.msgId);
    return NextResponse.json({ transcricao });
  } catch (err) {
    if (err instanceof TranscricaoIndisponivelError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    waLogger.error("falha ao transcrever áudio", { erro: err, conversationId: params.id });
    return NextResponse.json({ error: "Não foi possível transcrever o áudio agora" }, { status: 502 });
  }
}
