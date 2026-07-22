"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

interface Alerta {
  id: string;
  titulo: string;
  mensagem: string;
  criadoEm: string;
  criador: {
    nome: string;
  };
}

export function AlertaPopup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fila, setFila] = useState<Alerta[]>([]);
  const [atual, setAtual] = useState<Alerta | null>(null);

  // Buscar alertas não lidos para o usuário logado
  const { data: alertasData } = useQuery<{ data: Alerta[] }>({
    queryKey: ["alertas-ativos-popup"],
    queryFn: async () => {
      const { data } = await axios.get("/api/alertas");
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000, // verifica a cada 30s
    staleTime: 10000,
  });

  // Mutação para marcar como lido
  const lerMutation = useMutation({
    mutationFn: (id: string) => {
      return axios.post(`/api/alertas/${id}/ler`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-ativos-popup"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-gerenciamento"] });
    },
  });

  // Atualizar a fila quando chegam novas notificações do query
  useEffect(() => {
    if (alertasData?.data) {
      setFila(alertasData.data);
    }
  }, [alertasData]);

  // Gerenciar o alerta exibido na tela no momento
  useEffect(() => {
    if (!atual && fila.length > 0) {
      setAtual(fila[0]);
      setFila((f) => f.slice(1));
    }
  }, [atual, fila]);

  if (!atual) return null;

  function fechar() {
    // Ao clicar em entendido, marca na DB e passa pro próximo
    if (!atual) return;
    lerMutation.mutate(atual.id);
    setAtual(null);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">⚠️</span>
          <h2 className="text-lg font-bold text-foreground leading-tight">
            {atual.titulo}
          </h2>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3 text-sm text-foreground leading-relaxed">
          <p className="whitespace-pre-wrap">{atual.mensagem}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Enviado por: <strong>{atual.criador.nome}</strong>
        </p>

        <button
          onClick={fechar}
          disabled={lerMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          Entendido
        </button>

        {fila.length > 0 && (
          <p className="text-center text-[10px] text-muted-foreground">
            Mais {fila.length} aviso(s) importante(s) pendente(s)
          </p>
        )}
      </div>
    </div>
  );
}
