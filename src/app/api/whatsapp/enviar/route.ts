import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canViewAll } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/whatsapp/send";
import { uploadMedia, caminhoMedia, tipoDoMime } from "@/lib/whatsapp/media";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const formData = await request.formData();
  const conversaId = formData.get("conversaId") as string | null;
  const mensagem = (formData.get("mensagem") as string | null)?.trim() || undefined;
  const file = formData.get("file") as File | null;

  if (!conversaId || (!mensagem && !file)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const conversa = await prisma.whatsAppConversa.findUnique({
    where: { id: conversaId },
    include: { sessao: true },
  });

  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }
  if (!canViewAll(payload.role) && conversa.sessao.atendenteId !== payload.userId) {
    return NextResponse.json({ error: "Você não tem acesso a esta conversa" }, { status: 403 });
  }

  try {
    if (file) {
      const mimeType = file.type || "application/octet-stream";
      const path = caminhoMedia(conversa.sessaoId, conversa.id, mimeType, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadMedia(path, buffer, mimeType);

      const novaMensagem = await sendWhatsAppMedia(conversa, {
        tipo: tipoDoMime(mimeType),
        path,
        mimeType,
        legenda: mensagem,
        filename: file.name,
      });
      return NextResponse.json(novaMensagem, { status: 201 });
    }

    const novaMensagem = await sendWhatsAppMessage(conversa, mensagem!);
    return NextResponse.json(novaMensagem, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar mensagem" },
      { status: 502 }
    );
  }
}
