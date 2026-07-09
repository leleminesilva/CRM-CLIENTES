import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BUCKET = "whatsapp-media";
const MAX_BYTES = 25 * 1024 * 1024;

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (error && !error.message.includes("already exists")) throw new Error(error.message);
}

function tipoDoMime(mime: string): string {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "documento";
}

// Envio de mídia via CRM — só suportado pra instância QRCODE (bridge local/Baileys) por
// enquanto; a instância oficial da Meta continua só com texto pelo /enviar tradicional.
// Grava a mensagem como "pendente" com mediaUrl preenchido; o bridge baixa e entrega.
export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const conversaId = formData.get("conversaId") as string | null;
  const legenda = (formData.get("legenda") as string | null) || "";

  if (!file || !conversaId) {
    return NextResponse.json({ error: "file e conversaId obrigatórios" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 25MB)" }, { status: 400 });
  }

  const conversa = await prisma.whatsAppConversa.findUnique({
    where: { id: conversaId },
    include: { instancia: true },
  });
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  if (conversa.instancia.tipo !== "QRCODE") {
    return NextResponse.json({ error: "Envio de mídia só disponível na conexão via QR Code por enquanto" }, { status: 400 });
  }

  await ensureBucket();

  const ext = file.name?.split(".").pop()?.toLowerCase() || "bin";
  const path = `${conversa.instanciaId}/${randomUUID()}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);
  const tipo = tipoDoMime(file.type || "");

  const mensagem = await prisma.whatsAppMensagem.create({
    data: {
      conversaId: conversa.id,
      direcao: "saida",
      tipo,
      conteudo: legenda || file.name || `[${tipo}]`,
      mediaUrl: urlData.publicUrl,
      status: "pendente",
    },
  });

  await prisma.whatsAppConversa.update({ where: { id: conversa.id }, data: { ultimaMsgEm: new Date() } });

  return NextResponse.json(mensagem, { status: 201 });
}
