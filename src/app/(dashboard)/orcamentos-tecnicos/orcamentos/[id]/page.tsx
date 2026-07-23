"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { OrcamentoForm, type OrcamentoFormInitial } from "../OrcamentoForm";

export default function EditarOrcamentoPage() {
  const params = useParams<{ id: string }>();

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Orçamento #{data.numero}</h2>
        <p className="text-sm text-muted-foreground">Editar itens e dados gerais</p>
      </div>
      <OrcamentoForm mode="edit" orcamentoId={params.id} initialData={data} />
    </div>
  );
}
