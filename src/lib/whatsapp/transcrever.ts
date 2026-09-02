import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

// Transcrição de áudio do WhatsApp. Usa a API Whisper da OpenAI — só funciona
// se OPENAI_API_KEY estiver definido no ambiente. Sem a chave, o botão de
// transcrever some / avisa. Roda sob demanda, não persiste.

const BUCKET = "whatsapp-media";

export class TranscricaoIndisponivelError extends Error {
  constructor() {
    super("Transcrição de áudio não está configurada (defina OPENAI_API_KEY).");
    this.name = "TranscricaoIndisponivelError";
  }
}

export function transcricaoDisponivel(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function transcreverAudio(conversaId: string, mensagemId: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new TranscricaoIndisponivelError();

  const msg = await prisma.whatsAppMensagem.findFirstOrThrow({
    where: { id: mensagemId, conversaId },
  });
  if (msg.tipo !== "audio" || !msg.mediaUrl) throw new Error("Mensagem não é um áudio");

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(msg.mediaUrl);
  if (error || !data) throw new Error(error?.message ?? "Falha ao baixar o áudio");

  const ext = msg.mediaUrl.split(".").pop()?.toLowerCase() ?? "ogg";
  const buffer = Buffer.from(await data.arrayBuffer());

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: `audio/${ext === "mp3" ? "mpeg" : ext}` }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper respondeu ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { text?: string };
  const texto = (json.text ?? "").trim();
  if (!texto) throw new Error("Whisper não retornou texto");
  return texto;
}
