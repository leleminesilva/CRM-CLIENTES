import { NextRequest, NextResponse } from "next/server";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { sincronizarContaOpenFinance } from "@/lib/financeiro/open-finance";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  try {
    const resultado = await sincronizarContaOpenFinance(params.id, auth.payload.userId);
    return NextResponse.json({ data: resultado });
  } catch (error) {
    console.error("[open-finance] falha ao sincronizar conta", error);
    return NextResponse.json({ error: "Falha ao sincronizar conta" }, { status: 502 });
  }
}
