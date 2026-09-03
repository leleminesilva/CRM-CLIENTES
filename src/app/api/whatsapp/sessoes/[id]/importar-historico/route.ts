import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getProvider } from "@/lib/whatsapp/providers";
import { ingerirMensagem } from "@/lib/whatsapp/ingest";
import { emit } from "@/lib/whatsapp/events";
import { waLogger } from "@/lib/whatsapp/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORCAMENTO_MS = 45_000; // deixa folga pro maxDuration de 60s
const MAX_CHATS = 600;
const MSGS_POR_CHAT = 300;

// Importa as mensagens do último mês de uma sessão recém-conectada.
// Processa em blocos (cursor ?offset=) e se re-chama até terminar.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const interno = request.headers.get("x-wa-internal");
  const autorizadoInterno = !!interno && interno === process.env.EVOLUTION_API_KEY;

  const sessao = await prisma.whatsAppSessao.findUnique({ where: { id: params.id } });
  if (!sessao) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  if (!autorizadoInterno) {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!isAdmin(payload.role) && sessao.atendenteId !== payload.userId) {
      return NextResponse.json({ error: "Sem acesso a esta sessão" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const dias = Math.min(90, Math.max(7, parseInt(searchParams.get("dias") || "30")));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
  const desde = Date.now() - dias * 86_400_000;
  const fim = Date.now() + ORCAMENTO_MS;

  const provider = getProvider(sessao.provider);
  if (!provider.listarChats || !provider.buscarMensagens) {
    return NextResponse.json({ error: "Provider não suporta importação" }, { status: 400 });
  }

  const chats = (await provider.listarChats(sessao.providerSessionId)).slice(0, MAX_CHATS);

  let importadas = 0;
  let i = offset;
  for (; i < chats.length; i++) {
    if (Date.now() > fim) break;
    const chat = chats[i];
    try {
      const msgs = await provider.buscarMensagens(sessao.providerSessionId, chat.remoteJid, MSGS_POR_CHAT);
      const doMes = msgs
        .filter((m) => m.timestamp.getTime() >= desde)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      let conversaId: string | null = null;
      for (const m of doMes) {
        const res = await ingerirMensagem(sessao.id, m, provider, sessao.providerSessionId, {
          contaNaoLidas: false,
          baixarMidia: false,
        });
        if (res) {
          importadas++;
          conversaId = res.conversaId;
        }
      }
      if (conversaId) await emit("ConversationUpdated", { conversaId }, `import-${sessao.id}`);
    } catch (err) {
      waLogger.error("falha ao importar chat", { erro: err, sessionId: sessao.id });
    }
  }

  const completo = i >= chats.length;
  if (completo) {
    await prisma.whatsAppSessao.update({
      where: { id: sessao.id },
      data: { historicoImportadoEm: new Date() },
    });
  } else {
    // Continua de onde parou, numa invocação nova (fire-and-forget).
    try {
      const origin = new URL(request.url).origin;
      void fetch(`${origin}/api/whatsapp/sessoes/${sessao.id}/importar-historico?dias=${dias}&offset=${i}`, {
        method: "POST",
        headers: { "x-wa-internal": process.env.EVOLUTION_API_KEY ?? "" },
      }).catch(() => {});
    } catch {
      /* noop */
    }
  }

  return NextResponse.json({
    ok: true,
    importadas,
    chatsProcessados: i,
    totalChats: chats.length,
    completo,
    proximoOffset: completo ? null : i,
  });
}
