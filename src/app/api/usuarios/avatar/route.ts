import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket("avatars", {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (error && !error.message.includes("already exists")) throw new Error(error.message);
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const targetUserId = (formData.get("userId") as string | null) ?? payload.userId;

  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  if (targetUserId !== payload.userId && !isAdmin(payload.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "Apenas imagens são permitidas" }, { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "Imagem muito grande (máx. 5MB)" }, { status: 400 });

  await ensureBucket();

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${targetUserId}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(data.path);

  await prisma.user.update({ where: { id: targetUserId }, data: { avatar: urlData.publicUrl } });

  return NextResponse.json({ avatarUrl: urlData.publicUrl });
}
