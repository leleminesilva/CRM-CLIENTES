import { supabaseAdmin } from "@/lib/supabase";

// Mídia do WhatsApp (fotos, documentos, contratos) é potencialmente sensível
// — bucket privado, nunca público. mediaUrl no banco guarda o *caminho* no
// Storage, não uma URL; URLs assinadas (curta duração) são geradas sob
// demanda tanto pra servir ao frontend quanto pra entregar ao gateway no
// envio. Ver docs/architecture/whatsapp.md.

const BUCKET = "whatsapp-media";
const SIGNED_URL_TTL_LEITURA = 60 * 60; // 1h — consumo pelo frontend
const SIGNED_URL_TTL_ENVIO = 10 * 60; // 10min — só o tempo do gateway buscar e entregar

let bucketGarantido = false;

async function ensureBucket(): Promise<void> {
  if (bucketGarantido) return;
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024, // 25MB — limite comum de mídia do WhatsApp
  });
  if (error && !error.message.includes("already exists")) throw new Error(error.message);
  bucketGarantido = true;
}

export async function uploadMedia(path: string, conteudo: Buffer, mimeType: string): Promise<void> {
  await ensureBucket();
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, conteudo, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

export async function signedUrlMedia(path: string, finalidade: "leitura" | "envio" = "leitura"): Promise<string> {
  const ttl = finalidade === "envio" ? SIGNED_URL_TTL_ENVIO : SIGNED_URL_TTL_LEITURA;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, ttl);
  if (error || !data) throw new Error(error?.message ?? "Erro ao gerar URL assinada");
  return data.signedUrl;
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

export function caminhoMedia(sessaoId: string, conversaId: string, mimeType: string, filename?: string): string {
  const extensao = filename?.split(".").pop() ?? EXTENSAO_POR_MIME[mimeType] ?? "bin";
  return `${sessaoId}/${conversaId}/${Date.now()}.${extensao}`;
}

export function tipoDoMime(mimeType: string): "imagem" | "video" | "audio" | "documento" {
  if (mimeType.startsWith("image/")) return "imagem";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "documento";
}
