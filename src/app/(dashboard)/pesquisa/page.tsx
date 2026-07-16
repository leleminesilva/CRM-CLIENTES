"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Search as SearchIcon, ExternalLink, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ResultadoPesquisa {
  title: string;
  url: string;
  snippet: string;
  date?: string | null;
}

interface ResumoPesquisa {
  texto: string;
  citacoes: { title: string; url: string }[];
}

export default function PesquisaPage() {
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pesquisa", busca],
    queryFn: async () => {
      const { data } = await axios.get(`/api/pesquisa?q=${encodeURIComponent(busca)}`);
      return data as { results: ResultadoPesquisa[]; resumo: ResumoPesquisa | null };
    },
    enabled: busca.length > 0,
  });

  const resultados = data?.results ?? [];
  const resumo = data?.resumo ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusca(termo.trim());
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <SearchIcon className="w-6 h-6" />
          Pesquisa
        </h2>
        <p className="text-muted-foreground">Busque informações na web</p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="O que você quer pesquisar?"
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={!termo.trim()}>
            <SearchIcon className="w-4 h-4 mr-2" />
            Pesquisar
          </Button>
        </form>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-4 w-1/3 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="p-8 text-center text-muted-foreground">
          Não foi possível pesquisar agora. Tente novamente.
        </Card>
      )}

      {!isLoading && busca && resultados.length === 0 && !isError && (
        <Card className="p-12 text-center text-muted-foreground">
          <SearchIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>Nenhum resultado encontrado</p>
        </Card>
      )}

      {!isLoading && resumo && (
        <Card className="p-4 border-blue-500/30 bg-blue-500/[0.03]">
          <h3 className="font-medium flex items-center gap-1.5 text-sm mb-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Resumo
          </h3>
          <p className="text-sm whitespace-pre-line leading-relaxed">{resumo.texto}</p>
          {resumo.citacoes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {resumo.citacoes.map((c) => (
                <a
                  key={c.url}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors truncate max-w-[220px]"
                >
                  {c.title}
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      {!isLoading && resultados.length > 0 && (
        <div className="space-y-3">
          {resultados.map((r) => (
            <Card key={r.url} className="p-4 hover:bg-muted/30 transition-colors">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="group">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-blue-500 group-hover:underline flex items-center gap-1.5">
                    {r.title}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{r.url}</p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.snippet}</p>
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
