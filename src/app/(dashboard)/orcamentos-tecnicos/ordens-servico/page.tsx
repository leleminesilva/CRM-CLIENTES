"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { isOrdemAtrasada } from "@/lib/orcamentosTecnicos/ordemServico";

type StatusOS = "EM_PRODUCAO" | "CONCLUIDO" | "CANCELADO";

const STATUS_LABELS: Record<StatusOS, string> = {
  EM_PRODUCAO: "Em produção",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const STATUS_VARIANTS: Record<StatusOS, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  EM_PRODUCAO: "info",
  CONCLUIDO: "success",
  CANCELADO: "destructive",
};

interface OrdemServicoItem {
  id: string;
  status: StatusOS;
  progresso: number;
  previsaoEntrega: string;
  vendedor: { id: string; nome: string } | null;
  orcamento: { id: string; numero: number; valorTotal: string; cliente: { id: string; nome: string } | null };
}

export default function OrdensServicoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ordens-servico"],
    queryFn: async () => {
      const { data } = await axios.get("/api/orcamentos-tecnicos/ordens-servico");
      return data.data as OrdemServicoItem[];
    },
  });

  const ordens = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Ordens de Serviço</h2>
        <p className="text-sm text-muted-foreground">Nascem quando um orçamento é aprovado</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : ordens.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhuma ordem de serviço</p>
          <p className="text-sm text-muted-foreground mt-1">Aprove um orçamento pra criar a primeira</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordens.map(o => {
            const atrasado = isOrdemAtrasada(o.previsaoEntrega, o.status);
            return (
              <Link key={o.id} href={`/orcamentos-tecnicos/ordens-servico/${o.id}`}>
                <Card className="p-4 h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">Orçamento #{o.orcamento.numero}</p>
                    <div className="flex gap-1 shrink-0">
                      {atrasado && <Badge variant="destructive" className="text-xs">Atrasado</Badge>}
                      <Badge variant={STATUS_VARIANTS[o.status]} className="text-xs">{STATUS_LABELS[o.status]}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">{o.orcamento.cliente?.nome ?? "Sem cliente vinculado"}</p>
                  <p className="text-sm font-semibold mt-2">{formatCurrency(Number(o.orcamento.valorTotal))}</p>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span><span>{o.progresso}%</span>
                    </div>
                    <Progress value={o.progresso} />
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>Previsão: {formatDate(o.previsaoEntrega)}</span>
                    {o.vendedor && <span>{o.vendedor.nome}</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
