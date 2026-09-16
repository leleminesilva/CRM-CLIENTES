import { NextRequest, NextResponse } from "next/server";
import type { WebhookEventPayload } from "pluggy-sdk";
import { sincronizarItemOpenFinance } from "@/lib/financeiro/open-finance";

export const dynamic = "force-dynamic";

// Endpoint público (chamado pela Pluggy, não por um usuário logado — sem cookie de sessão
// pra checar). A Pluggy NÃO assina o payload (sem HMAC, só IP allowlist opcional), então a
// defesa aqui é um header secreto compartilhado, configurado na hora de registrar o webhook
// (POST /webhooks com `headers`, ver docs.pluggy.ai/docs/webhooks — só dá pra setar headers
// customizados por essa via, não pelo `webhookUrl` do connect_token).
function autenticado(request: NextRequest): boolean {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  return !!secret && request.headers.get("x-webhook-secret") === secret;
}

// A Pluggy espera 2XX em até 5s e reenvia em caso de erro (até 9 tentativas: 3 + 3 após 1h +
// 3 após 2h). Processamos de forma síncrona mesmo assim — não há fila configurada no projeto,
// e uma sincronização por item é rápida o bastante pra caber na janela. Se algo falhar aqui,
// devolvemos 500 de propósito pra Pluggy reenviar depois; sincronizarItemOpenFinance é
// idempotente (createMany com skipDuplicates via pluggyTransactionId único), então reprocessar
// o mesmo evento não duplica nada.
export async function POST(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as WebhookEventPayload | null;
  if (!payload?.event) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  try {
    switch (payload.event) {
      case "item/created":
      case "item/updated":
      case "transactions/created":
      case "transactions/updated":
        await sincronizarItemOpenFinance(payload.itemId);
        break;
      case "item/error":
        console.error(`[open-finance] item ${payload.itemId} com erro:`, payload.error);
        break;
      default:
        // Outros eventos (pagamentos, etc.) não se aplicam a este módulo — ignora.
        break;
    }
  } catch (error) {
    console.error("[open-finance] falha ao processar webhook", payload.event, error);
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
