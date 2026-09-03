import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const etapas = await prisma.whatsAppEtapa.findMany({ orderBy: { ordem: "asc" } });
  return NextResponse.json({ etapas, podeEditar: isAdmin(payload.role) });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome ?? "").trim();
  if (!nome) return NextResponse.json({ error: "Dê um nome à coluna" }, { status: 400 });
  const cor = typeof body.cor === "string" && HEX.test(body.cor) ? body.cor : "#6366f1";

  const ultima = await prisma.whatsAppEtapa.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
  const etapa = await prisma.whatsAppEtapa.create({
    data: { nome: nome.slice(0, 40), cor, ordem: (ultima?.ordem ?? -1) + 1, sistema: false },
  });
  return NextResponse.json(etapa, { status: 201 });
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
    ids.map((id: string, i: number) =>
      prisma.whatsAppEtapa.update({ where: { id }, data: { ordem: i } })
    )
  );
  const etapas = await prisma.whatsAppEtapa.findMany({ orderBy: { ordem: "asc" } });
  return NextResponse.json({ etapas });
}
