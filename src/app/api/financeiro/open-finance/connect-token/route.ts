import { NextRequest, NextResponse } from "next/server";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { createConnectToken } from "@/lib/pluggy";

export const dynamic = "force-dynamic";

// itemId no body = reabrir o widget pra reconectar um item existente (ex: credencial expirada).
export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const itemId = typeof body?.itemId === "string" ? body.itemId : undefined;

  try {
    const accessToken = await createConnectToken(itemId);
    return NextResponse.json({ data: { accessToken } });
  } catch (error) {
    console.error("[open-finance] falha ao criar connect token", error);
    return NextResponse.json({ error: "Falha ao iniciar conexão com Open Finance" }, { status: 502 });
  }
}
