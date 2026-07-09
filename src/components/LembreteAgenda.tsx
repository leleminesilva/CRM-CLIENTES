"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, Clock, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TIPO_TAREFA_LABELS, dataHoraVencimento, hojeISO } from "@/lib/utils/formatters";
import type { Tarefa } from "@/types";

const STORAGE_KEY = "crm_agenda_lembretes_disparados";
const RETENCAO_MS = 3 * 24 * 60 * 60 * 1000; // esquece disparos com mais de 3 dias
const TOLERANCIA_ATRASO_MS = 15 * 60 * 1000; // tarefas com horário: só alerta até 15min de atraso

const TIPO_COLORS: Record<string, string> = {
  REUNIAO: "#6366f1",
  LIGACAO: "#8b5cf6",
  VISITA: "#ec4899",
  FOLLOW_UP: "#f59e0b",
  EMAIL: "#3b82f6",
  TAREFA: "#64748b",
};

function carregarDisparados(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const dados = JSON.parse(raw) as Record<string, number>;
    const limite = Date.now() - RETENCAO_MS;
    for (const id of Object.keys(dados)) {
      if (dados[id] < limite) delete dados[id];
    }
    return dados;
  } catch {
    return {};
  }
}

function salvarDisparados(dados: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch {
    // localStorage indisponível
  }
}

export function LembreteAgenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const disparadosRef = useRef<Record<string, number>>({});
  const [fila, setFila] = useState<Tarefa[]>([]);
  const [atual, setAtual] = useState<Tarefa | null>(null);

  useEffect(() => {
    disparadosRef.current = carregarDisparados();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const hojeStr = hojeISO();
  const { data: tarefas } = useQuery({
    queryKey: ["tarefas-lembrete", hojeStr],
    queryFn: async () => {
      const { data } = await axios.get(`/api/tarefas?de=${hojeStr}&ate=${hojeStr}`);
      return data.data as Tarefa[];
    },
    enabled: !!user,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const concluirMutation = useMutation({
    mutationFn: (id: string) => axios.put(`/api/tarefas/${id}`, { concluir: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas-lembrete"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-hoje"] });
    },
  });

  const verificar = useCallback(() => {
    if (!tarefas || !user) return;
    const agora = Date.now();

    const pendentes = tarefas.filter(
      (t) => (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO") && t.responsavelId === user.id
    );

    const novas: Tarefa[] = [];
    for (const t of pendentes) {
      if (disparadosRef.current[t.id]) continue;
      const alvo = dataHoraVencimento(t).getTime();
      const atrasoOk = t.horario ? agora - alvo <= TOLERANCIA_ATRASO_MS : true;
      if (alvo <= agora && atrasoOk) {
        disparadosRef.current[t.id] = agora;
        novas.push(t);

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Lembrete da agenda", {
              body: `${t.titulo}${t.horario ? ` às ${t.horario}` : ""}`,
              tag: t.id,
            });
          } catch {
            // navegador pode bloquear notificações
          }
        }
      }
    }

    if (novas.length) {
      salvarDisparados(disparadosRef.current);
      setFila((f) => [...f, ...novas]);
    }
  }, [tarefas, user]);

  useEffect(() => {
    verificar();
    const interval = setInterval(verificar, 15000);
    return () => clearInterval(interval);
  }, [verificar]);

  useEffect(() => {
    if (!atual && fila.length > 0) {
      setAtual(fila[0]);
      setFila((f) => f.slice(1));
    }
  }, [atual, fila]);

  if (!atual) return null;

  const cor = TIPO_COLORS[atual.tipo] || "#6366f1";

  function fechar() {
    setAtual(null);
  }

  function concluir() {
    if (atual) concluirMutation.mutate(atual.id);
    setAtual(null);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">⏰</span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: cor }}>
                Lembrete da Agenda
              </p>
              <h2 className="text-lg font-bold text-foreground leading-tight">{atual.titulo}</h2>
            </div>
          </div>
          <button onClick={fechar} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-lg p-4 border" style={{ backgroundColor: `${cor}1a`, borderColor: `${cor}4d` }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: cor }}>
              {TIPO_TAREFA_LABELS[atual.tipo] || atual.tipo}
            </span>
            {atual.horario && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {atual.horario}
              </span>
            )}
          </div>
          {atual.descricao && (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{atual.descricao}</p>
          )}
          {(atual.cliente?.nome || atual.lead?.titulo) && (
            <p className="text-xs text-muted-foreground mt-2">
              {atual.cliente?.nome ? `Cliente: ${atual.cliente.nome}` : `Lead: ${atual.lead?.titulo}`}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={fechar}
            className="flex-1 py-2.5 rounded-lg border border-border text-center text-sm font-semibold hover:bg-muted transition-colors"
          >
            Dispensar
          </button>
          <button
            onClick={concluir}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            style={{ backgroundColor: cor }}
          >
            <CheckCircle2 className="w-4 h-4" /> Concluir
          </button>
        </div>

        {fila.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">+{fila.length} lembrete(s) na fila</p>
        )}
      </div>
    </div>
  );
}
