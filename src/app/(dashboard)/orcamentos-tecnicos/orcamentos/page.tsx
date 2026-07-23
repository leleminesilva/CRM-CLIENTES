"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";

type StatusOrcamento = "RASCUNHO" | "ENVIADO" | "APROVADO" | "REPROVADO";

const STATUS_LABELS: Record<StatusOrcamento, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

const STATUS_VARIANTS: Record<StatusOrcamento, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  RASCUNHO: "secondary",
  ENVIADO: "info",
  APROVADO: "success",
  REPROVADO: "destructive",
};

interface OrcamentoListItem {
  id: string;
  numero: number;
  status: StatusOrcamento;
  valorTotal: string;
  createdAt: string;
  cliente: { id: string; nome: string } | null;
  responsavel: { id: string; nome: string } | null;
  ordemServico: { id: string; status: string } | null;
  _count: { itens: number };
}

export default function OrcamentosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orcamentos-tecnicos"],
    queryFn: async () => {
      const { data } = await axios.get("/api/orcamentos-tecnicos/orcamentos?limit=50");
      return data.data as OrcamentoListItem[];
    },
  });

  const orcamentos = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Orçamentos</h2>
          <p className="text-sm text-muted-foreground">Motor de cálculo por vão/vidro — linha, produto, variante e dimensões</p>
        </div>
        <Link href="/orcamentos-tecnicos/orcamentos/novo">
          <Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo orçamento</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : orcamentos.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhum orçamento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em &quot;Novo orçamento&quot; para começar</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orcamentos.map(o => (
            <Link key={o.id} href={`/orcamentos-tecnicos/orcamentos/${o.id}`}>
              <Card className="p-4 h-full hover:border-primary/50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">Orçamento #{o.numero}</p>
                  <Badge variant={STATUS_VARIANTS[o.status]} className="text-xs shrink-0">{STATUS_LABELS[o.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{o.cliente?.nome ?? "Sem cliente vinculado"}</p>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-lg font-bold">{formatCurrency(Number(o.valorTotal))}</p>
                    <p className="text-xs text-muted-foreground">{o._count.itens} item(ns) · {formatDateTime(o.createdAt)}</p>
                  </div>
                  {o.responsavel && <p className="text-xs text-muted-foreground shrink-0">{o.responsavel.nome}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
