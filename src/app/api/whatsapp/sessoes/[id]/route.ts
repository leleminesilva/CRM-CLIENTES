import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { WhatsAppService } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:manage_sessoes")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    await WhatsAppService.excluirSessao(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WA Sessoes]", error);
    return NextResponse.json({ error: "Erro ao remover sessão" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:manage_sessoes")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  if (!("atendenteId" in body)) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const sessao = await WhatsAppService.reatribuirAtendente(params.id, body.atendenteId ?? null);
  return NextResponse.json(sessao);
}
