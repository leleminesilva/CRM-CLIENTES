import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";
import { registrarMensagemRecebida } from "@/lib/whatsapp/bridgeReceive";

export const dynamic = "force-dynamic";

const BUCKET = "whatsapp-media";
const MAX_BYTES = 25 * 1024 * 1024; // limite do próprio WhatsApp pra mídia é ~16-64MB por tipo

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (error && !error.message.includes("already exists")) throw new Error(error.message);
}

// Recebe mídia (imagem/áudio/vídeo/documento/figurinha) que o bridge já baixou do
// WhatsApp — o corpo é multipart/form-data com o arquivo + os mesmos metadados de
// /bridge/receber. Sobe pro Storage e grava a mensagem com mediaUrl preenchido.
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const instanciaId = formData.get("instanciaId") as string | null;
  const telefone = formData.get("telefone") as string | null;
  const nome = (formData.get("nome") as string | null) || undefined;
  const conteudo = (formData.get("conteudo") as string | null) || "";
  const tipo = (formData.get("tipo") as string | null) || "documento";
  const direcao = (formData.get("direcao") as string | null) || "entrada";
  const waId = (formData.get("waId") as string | null) || undefined;
  const enviadaEm = (formData.get("enviadaEm") as string | null) || undefined;

  if (!file || !instanciaId || !telefone) {
    return NextResponse.json({ error: "file, instanciaId e telefone obrigatórios" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande" }, { status: 400 });
  }

  await ensureBucket();

  const ext = file.name?.split(".").pop()?.toLowerCase() || "bin";
  const path = `${instanciaId}/${waId || randomUUID()}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

  const mensagem = await registrarMensagemRecebida({
    instanciaId,
    telefone,
    nome,
    conteudo: conteudo || `[${tipo}]`,
    tipo,
    direcao,
    waId,
    enviadaEm,
    mediaUrl: urlData.publicUrl,
  });

  return NextResponse.json({ ok: true, mensagem });
}
