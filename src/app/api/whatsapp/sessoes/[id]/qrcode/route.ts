import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { WhatsAppService, PosseError } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

// Fetch pontual do QR — o caminho principal de atualização é o broadcast do
// Realtime (ver src/lib/whatsapp/realtime.ts); esta rota é o fallback pra
// quando o frontend abre a tela depois do QR já ter sido gerado.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const resultado = await WhatsAppService.obterQrCode(params.id, payload);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof PosseError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[WA QrCode]", error);
    return NextResponse.json({ error: "Erro ao buscar QR Code" }, { status: 502 });
  }
}
