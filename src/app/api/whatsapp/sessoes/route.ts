import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { WhatsAppService, LimiteSessaoError } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

// Rotas de sessão — Fase 1 traz o mínimo pra compilar e ter um fluxo
// funcional; QR ao vivo/Realtime/reconectar/log de auditoria são Fase 2.
// Ver docs/architecture/whatsapp.md.

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // escopo=todas só tem efeito pra Admin/Dev (o service reforça); os demais
  // sempre recebem só as próprias.
  const escopo =
    request.nextUrl.searchParams.get("escopo") === "todas" ? "todas" : "minhas";
  const sessoes = await WhatsAppService.listarSessoes(payload, escopo);
  return NextResponse.json(sessoes);
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { nome, atendenteId } = body;
  if (!nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  try {
    // cargo comum: o service ignora atendenteId e força o próprio usuário.
    const sessao = await WhatsAppService.criarSessao(payload, nome, atendenteId ?? null);
    return NextResponse.json(sessao, { status: 201 });
  } catch (error) {
    if (error instanceof LimiteSessaoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[WA Sessoes]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar sessão" },
      { status: 502 }
    );
  }
}
