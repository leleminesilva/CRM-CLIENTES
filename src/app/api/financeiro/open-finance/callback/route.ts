import { NextRequest, NextResponse } from "next/server";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { importarItemOpenFinance } from "@/lib/financeiro/open-finance";

export const dynamic = "force-dynamic";

// Chamado pelo frontend logo após o widget Pluggy Connect disparar onSuccess.
export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const itemId = typeof body?.itemId === "string" ? body.itemId : undefined;
  if (!itemId) {
    return NextResponse.json({ error: "itemId ausente" }, { status: 400 });
  }

  try {
    const contas = await importarItemOpenFinance(itemId, auth.payload.userId);
    return NextResponse.json({ data: { contas } });
  } catch (error) {
    console.error("[open-finance] falha ao importar item", error);
    return NextResponse.json({ error: "Falha ao importar dados da conta conectada" }, { status: 502 });
  }
}
