import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { WhatsAppService, PosseError } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    await WhatsAppService.reiniciarSessao(params.id, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PosseError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[WA Reiniciar]", error);
    return NextResponse.json({ error: "Erro ao reiniciar sessão" }, { status: 502 });
  }
}
