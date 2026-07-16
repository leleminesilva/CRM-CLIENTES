import { supabaseAdmin } from "@/lib/supabase";

// Broadcast efêmero via Supabase Realtime — nunca grava linha, só transmite
// pro canal da sessão. É assim que o QR Code chega ao vivo no frontend sem
// polling, e é como mudanças de status também são propagadas instantaneamente
// (além de já estarem persistidas no Postgres). Ver docs/architecture/whatsapp.md.

export function canalSessao(sessaoId: string) {
  return `whatsapp-sessao-${sessaoId}`;
}

export interface SessaoBroadcastPayload {
  status?: string;
  qrCode?: string | null;
  lastError?: string | null;
}

export async function publicarSessao(sessaoId: string, payload: SessaoBroadcastPayload): Promise<void> {
  const channel = supabaseAdmin.channel(canalSessao(sessaoId));
  try {
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });
    await channel.send({ type: "broadcast", event: "sessao_atualizada", payload });
  } finally {
    await supabaseAdmin.removeChannel(channel);
  }
}
