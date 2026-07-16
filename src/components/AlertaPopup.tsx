"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Megaphone, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="bg-card border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header decorativo */}
        <div className="bg-gradient-to-r from-red-600 to-indigo-600 p-6 text-white relative">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Megaphone className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/80">Alerta de Administrador</span>
              <h2 className="text-xl font-extrabold leading-tight">{atual.titulo}</h2>
            </div>
          </div>
        </div>

        {/* Conteúdo do alerta */}
        <div className="p-6 space-y-6">
          <div className="bg-accent/40 rounded-xl p-4 border border-border/40 min-h-[100px] flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {atual.mensagem}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Enviado por: <strong>{atual.criador.nome}</strong></span>
          </div>

          {/* Botão Entendido */}
          <Button
            onClick={fechar}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-6 rounded-xl transition-all shadow-lg hover:shadow-red-600/20 text-sm flex items-center justify-center gap-2"
            disabled={lerMutation.isPending}
          >
            Entendido
          </Button>
        </div>

        {fila.length > 0 && (
          <div className="bg-muted/30 py-2 border-t text-center text-[10px] text-muted-foreground">
            Mais {fila.length} aviso(s) importante(s) pendente(s)
          </div>
        )}
      </div>
    </div>
  );
}
