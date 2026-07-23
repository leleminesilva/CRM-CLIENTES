"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { OrcamentoForm, type OrcamentoFormInitial } from "../OrcamentoForm";

const STATUS_LABELS: Record<OrcamentoFormInitial["status"], string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

const STATUS_VARIANTS: Record<OrcamentoFormInitial["status"], "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  RASCUNHO: "secondary",
  ENVIADO: "info",
  APROVADO: "success",
  REPROVADO: "destructive",
};

function AprovarDialog({ orcamentoId, responsavelId }: { orcamentoId: string; responsavelId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");

  const aprovarMutation = useMutation({
    mutationFn: () => axios.post(`/api/orcamentos-tecnicos/orcamentos/${orcamentoId}/aprovar`, {
      previsaoEntrega, vendedorId: responsavelId,
    }),
    onSuccess: (res) => {
      toast.success("Orçamento aprovado — Ordem de Serviço criada");
      router.push(`/orcamentos-tecnicos/ordens-servico/${res.data.data.id}`);
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : undefined;
      toast.error(msg || "Erro ao aprovar orçamento");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><CheckCircle2 className="w-4 h-4 mr-2" />Aprovar orçamento</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Aprovar orçamento</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">Cria uma Ordem de Serviço vinculada, com esta previsão de entrega.</p>
          <div className="space-y-1.5">
            <Label>Previsão de entrega *</Label>
            <Input type="date" value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => aprovarMutation.mutate()} disabled={!previsaoEntrega || aprovarMutation.isPending}>
              {aprovarMutation.isPending ? "Aprovando..." : "Confirmar aprovação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EditarOrcamentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["orcamento-tecnico", params.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/orcamentos-tecnicos/orcamentos/${params.id}`);
      return data.data as OrcamentoFormInitial;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-center py-12">Orçamento não encontrado.</p>;
  }

  const podeAprovar = !data.ordemServico && (data.status === "RASCUNHO" || data.status === "ENVIADO");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Orçamento #{data.numero}</h2>
            <Badge variant={STATUS_VARIANTS[data.status]}>{STATUS_LABELS[data.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Editar itens e dados gerais</p>
        </div>
        {podeAprovar && <AprovarDialog orcamentoId={params.id} responsavelId={data.responsavelId} />}
        {data.ordemServico && (
          <Button variant="outline" onClick={() => router.push(`/orcamentos-tecnicos/ordens-servico/${data.ordemServico!.id}`)}>
            Ver Ordem de Serviço
          </Button>
        )}
      </div>
      <OrcamentoForm mode="edit" orcamentoId={params.id} initialData={data} />
    </div>
  );
}
