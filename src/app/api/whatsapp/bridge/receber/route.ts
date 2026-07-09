import { NextRequest, NextResponse } from "next/server";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";
import { registrarMensagemRecebida } from "@/lib/whatsapp/bridgeReceive";

export const dynamic = "force-dynamic";

// Chamado pelo bridge sempre que chega uma mensagem de texto (ao vivo ou histórica, na
// primeira sincronização) no WhatsApp Web conectado. Mensagens com mídia vão por
// /bridge/receber-midia. Só grava a conversa/mensagem — sem acionar o agente de IA de
// recepção (isso fica só pra instância oficial da Meta).
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { instanciaId, telefone, nome, conteudo, tipo, direcao, waId, enviadaEm } = await request.json();
  if (!instanciaId || !telefone || !conteudo) {
    return NextResponse.json({ error: "instanciaId, telefone e conteudo obrigatórios" }, { status: 400 });
  }

  const mensagem = await registrarMensagemRecebida({
    instanciaId, telefone, nome, conteudo, tipo, direcao, waId, enviadaEm,
  });

  return NextResponse.json({ ok: true, mensagem });
}
