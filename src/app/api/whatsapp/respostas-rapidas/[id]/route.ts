import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const existe = await prisma.whatsAppRespostaRapida.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { texto?: string; ordem?: number } = {};
  if (typeof body.texto === "string" && body.texto.trim()) data.texto = body.texto.trim().slice(0, 500);
  if (typeof body.ordem === "number" && Number.isInteger(body.ordem)) data.ordem = body.ordem;

  const atualizada = await prisma.whatsAppRespostaRapida.update({ where: { id: params.id }, data });
  return NextResponse.json(atualizada);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  await prisma.whatsAppRespostaRapida.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
