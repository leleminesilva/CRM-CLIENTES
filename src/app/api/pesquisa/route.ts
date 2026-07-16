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

    const [searchResult, resumoResult] = await Promise.allSettled([
      client.search.create({ query, max_results: 10 }),
      client.responses.create({ preset: "pro-search", input: query }),
    ]);

    if (searchResult.status === "rejected") console.error("Erro em search.create:", searchResult.reason);
    if (resumoResult.status === "rejected") console.error("Erro em responses.create:", resumoResult.reason);

    const results = searchResult.status === "fulfilled" ? searchResult.value.results : [];

    let resumo: { texto: string; citacoes: { title: string; url: string }[] } | null = null;
    if (resumoResult.status === "fulfilled") {
      const texto = resumoResult.value.output_text ?? "";
      const citacoes = new Map<string, string>();
      for (const item of resumoResult.value.output) {
        if (item.type !== "message") continue;
        for (const part of item.content) {
          for (const ann of part.annotations ?? []) {
            if (ann.url) citacoes.set(ann.url, ann.title || ann.url);
          }
        }
      }
      resumo = texto ? { texto, citacoes: Array.from(citacoes, ([url, title]) => ({ url, title })) } : null;
    }

    return NextResponse.json({ results, resumo });
  } catch (error) {
    console.error("Erro na pesquisa:", error);
    return NextResponse.json({ error: "Erro ao pesquisar" }, { status: 500 });
  }
}
