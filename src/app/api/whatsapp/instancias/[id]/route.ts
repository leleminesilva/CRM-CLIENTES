import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!["ADMINISTRADOR", "DESENVOLVEDOR", "GESTOR"].includes(payload.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  await prisma.whatsAppInstancia.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!["ADMINISTRADOR", "DESENVOLVEDOR", "GESTOR"].includes(payload.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const instancia = await prisma.whatsAppInstancia.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(instancia);
}
