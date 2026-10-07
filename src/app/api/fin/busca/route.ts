import { NextResponse } from "next/server";
import { getContext } from "@fin/lib/context";
import { logger } from "@fin/lib/logger";
import { searchAll } from "@fin/modules/search/service";

/** Busca global autenticada: GET /api/busca?q=termo */
export async function GET(request: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const result = await searchAll(ctx, q);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logger.error({ err: error }, "Falha na busca global");
    return NextResponse.json({ error: "Não foi possível buscar agora." }, { status: 500 });
  }
}
