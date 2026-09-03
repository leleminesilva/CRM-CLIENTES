import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const etapa = await prisma.whatsAppEtapa.findUnique({ where: { id: params.id } });
  if (!etapa) return NextResponse.json({ error: "Coluna não encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { nome?: string; cor?: string; ordem?: number } = {};
  if (typeof body.nome === "string" && body.nome.trim()) data.nome = body.nome.trim().slice(0, 40);
  if (typeof body.cor === "string" && HEX.test(body.cor)) data.cor = body.cor;
  if (typeof body.ordem === "number" && Number.isInteger(body.ordem)) data.ordem = body.ordem;

  const atualizada = await prisma.whatsAppEtapa.update({ where: { id: params.id }, data });
  return NextResponse.json(atualizada);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const etapa = await prisma.whatsAppEtapa.findUnique({ where: { id: params.id } });
  if (!etapa) return NextResponse.json({ ok: true });
  if (etapa.sistema) {
    return NextResponse.json({ error: "As 6 colunas padrão não podem ser excluídas (só renomeadas e reordenadas)." }, { status: 400 });
  }

  // Manda as conversas dessa coluna pra primeira coluna restante.
  const destino = await prisma.whatsAppEtapa.findFirst({
    where: { id: { not: params.id } },
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.whatsAppConversa.updateMany({
      where: { etapa: params.id },
      data: { etapa: destino?.id ?? "NOVA" },
    }),
    prisma.whatsAppEtapa.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true, movidasPara: destino?.id ?? "NOVA" });
}
