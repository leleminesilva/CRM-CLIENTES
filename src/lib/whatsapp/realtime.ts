import { supabaseAdmin } from "@/lib/supabase";

// Broadcast efêmero via Supabase Realtime — nunca grava linha, só transmite
// pro canal da sessão. É assim que o QR Code chega ao vivo no frontend sem
// polling, e é como mudanças de status também são propagadas instantaneamente
// (além de já estarem persistidas no Postgres). Ver docs/architecture/whatsapp.md.

export function canalSessao(sessaoId: string) {
  return `whatsapp-sessao-${sessaoId}`;
}

export function canalConversa(conversaId: string) {
  return `whatsapp-conversa-${conversaId}`;
}

async function publicar(canal: string, evento: string, payload: unknown): Promise<void> {
  const channel = supabaseAdmin.channel(canal);
  try {
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });
    await channel.send({ type: "broadcast", event: evento, payload });
  } finally {
    await supabaseAdmin.removeChannel(channel);
  }
}

export interface SessaoBroadcastPayload {
  status?: string;
  qrCode?: string | null;
  lastError?: string | null;
}

export async function publicarSessao(sessaoId: string, payload: SessaoBroadcastPayload): Promise<void> {
  await publicar(canalSessao(sessaoId), "sessao_atualizada", payload);
}

// Sinal leve — "essa conversa mudou", sem duplicar o conteúdo da mensagem.
// O frontend reage invalidando a query REST correspondente.
export async function publicarConversa(conversaId: string): Promise<void> {
  await publicar(canalConversa(conversaId), "conversa_atualizada", { conversaId });
}
