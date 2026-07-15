import { NextRequest, NextResponse } from "next/server";
import Perplexity from "@perplexity-ai/perplexity_ai";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "pesquisa:view");

    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query) return NextResponse.json({ error: "Informe uma busca" }, { status: 400 });

    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({ error: "Pesquisa não configurada" }, { status: 503 });
    }

    const client = new Perplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
    const search = await client.search.create({ query, max_results: 10 });

    return NextResponse.json({ results: search.results });
  } catch (error) {
    console.error("Erro na pesquisa:", error);
    return NextResponse.json({ error: "Erro ao pesquisar" }, { status: 500 });
  }
}
