import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket("produtos-catalogo", {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (error && !error.message.includes("already exists")) throw new Error(error.message);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "catalogo:update")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const produto = await prisma.produtoCatalogo.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "Apenas imagens são permitidas" }, { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "Imagem muito grande (máx. 5MB)" }, { status: 400 });

  await ensureBucket();

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${params.id}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from("produtos-catalogo")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from("produtos-catalogo").getPublicUrl(data.path);
  // cache-bust: mesmo path, upsert sobrescreve o arquivo mas a URL pública não muda sozinha
  const imagemUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  await prisma.produtoCatalogo.update({ where: { id: params.id }, data: { imagemUrl } });

  return NextResponse.json({ imagemUrl });
}
