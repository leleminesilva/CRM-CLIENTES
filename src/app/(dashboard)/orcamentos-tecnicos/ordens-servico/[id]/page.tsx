"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/formatters";
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

interface UsuarioOption { id: string; nome: string; }

interface OrdemServicoDetalhe {
  id: string;
  status: StatusOS;
  progresso: number;
  previsaoEntrega: string;
  vendedor: { id: string; nome: string } | null;
  orcamento: {
    id: string;
    numero: number;
    valorTotal: string;
    bairroInstalacao: string | null;
    enderecoInstalacao: string | null;
    cliente: { id: string; nome: string } | null;
    itens: {
      id: string;
      quantidade: number;
      totalItem: string;
      produto: { nome: string };
      variante: { nome: string } | null;
    }[];
  };
}

export default function OrdemServicoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ordem-servico", params.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/orcamentos-tecnicos/ordens-servico/${params.id}`);
      return data.data as OrdemServicoDetalhe;
    },
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-select"],
    queryFn: async () => { const { data } = await axios.get("/api/usuarios"); return data.data as UsuarioOption[]; },
  });

  const [progresso, setProgresso] = useState(0);
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");

  useEffect(() => {
    if (!data) return;
    setProgresso(data.progresso);
    setVendedorId(data.vendedor?.id ?? null);
    setPrevisaoEntrega(data.previsaoEntrega.slice(0, 10));
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => axios.put(`/api/orcamentos-tecnicos/ordens-servico/${params.id}`, body),
    onSuccess: () => {
      toast.success("Ordem de serviço atualizada");
      qc.invalidateQueries({ queryKey: ["ordem-servico", params.id] });
      qc.invalidateQueries({ queryKey: ["ordens-servico"] });
    },
    onError: () => toast.error("Erro ao atualizar ordem de serviço"),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <p className="text-muted-foreground text-center py-12">Ordem de serviço não encontrada.</p>;
  }

  const atrasado = isOrdemAtrasada(data.previsaoEntrega, data.status);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Ordem de Serviço — Orçamento #{data.orcamento.numero}</h2>
          <p className="text-sm text-muted-foreground">{data.orcamento.cliente?.nome ?? "Sem cliente vinculado"}</p>
        </div>
        <div className="flex gap-1">
          {atrasado && <Badge variant="destructive">Atrasado</Badge>}
          <Badge variant={STATUS_VARIANTS[data.status]}>{STATUS_LABELS[data.status]}</Badge>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Itens do orçamento</h3>
        {data.orcamento.itens.map(item => (
          <div key={item.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
            <span>{item.produto.nome}{item.variante && ` · ${item.variante.nome}`} <span className="text-muted-foreground">(qtd {item.quantidade})</span></span>
            <span className="font-medium">{formatCurrency(Number(item.totalItem))}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 border-t font-bold">
          <span>Total</span><span>{formatCurrency(Number(data.orcamento.valorTotal))}</span>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Produção</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={vendedorId ?? "none"} onValueChange={v => setVendedorId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Previsão de entrega</Label>
            <Input type="date" value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <Label>Progresso do serviço</Label>
            <span>{progresso}%</span>
          </div>
          <Progress value={progresso} />
          <Input
            type="range" min={0} max={100} step={5} value={progresso}
            onChange={e => setProgresso(Number(e.target.value))}
            className="h-auto p-0 border-0"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => updateMutation.mutate({ vendedorId, previsaoEntrega, progresso })}
            disabled={updateMutation.isPending}
          >
            Salvar
          </Button>
          {data.status === "EM_PRODUCAO" ? (
            <>
              <Button
                variant="outline" className="text-red-600 hover:text-red-700"
                onClick={() => updateMutation.mutate({ status: "CANCELADO" })}
                disabled={updateMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => updateMutation.mutate({ status: "CONCLUIDO", progresso: 100 })}
                disabled={updateMutation.isPending}
              >
                Concluir pedido
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => updateMutation.mutate({ status: "EM_PRODUCAO" })} disabled={updateMutation.isPending}>
              Reabrir
            </Button>
          )}
        </div>
      </Card>

      <Button variant="ghost" onClick={() => router.push(`/orcamentos-tecnicos/orcamentos/${data.orcamento.id}`)}>
        Ver orçamento original
      </Button>
    </div>
  );
}
