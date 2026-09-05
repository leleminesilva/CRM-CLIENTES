import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const respostas = await prisma.whatsAppRespostaRapida.findMany({ orderBy: { ordem: "asc" } });
  return NextResponse.json({ respostas, podeEditar: isAdmin(payload.role) });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const texto = String(body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ error: "Escreva o texto da resposta" }, { status: 400 });

  const ultima = await prisma.whatsAppRespostaRapida.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
  const resposta = await prisma.whatsAppRespostaRapida.create({
    data: { texto: texto.slice(0, 500), ordem: (ultima?.ordem ?? -1) + 1 },
  });
  return NextResponse.json(resposta, { status: 201 });
}

// Reordena em lote: recebe { ids: [...] } na nova ordem.
export async function PUT(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((i: unknown): i is string => typeof i === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Lista vazia" }, { status: 400 });

  await prisma.$transaction(
    ids.map((id: string, i: number) => prisma.whatsAppRespostaRapida.update({ where: { id }, data: { ordem: i } })),
  );
  const respostas = await prisma.whatsAppRespostaRapida.findMany({ orderBy: { ordem: "asc" } });
  return NextResponse.json({ respostas });
}
