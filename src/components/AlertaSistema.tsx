"use client";

import { useEffect, useState } from "react";

const ALERTA_KEY = "crm_alerta_sistema_v2";

export function AlertaSistema() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ALERTA_KEY)) {
        setAberto(true);
      }
    } catch {
      // localStorage indisponível
    }
  }, []);

  function fechar() {
    try { localStorage.setItem(ALERTA_KEY, "visto"); } catch { /* */ }
    setAberto(false);
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">🚨</span>
          <h2 className="text-lg font-bold text-foreground leading-tight">
            Atualização Importante do Sistema
          </h2>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            A partir de hoje, todos os clientes que permanecerem sem atualizações dentro de dois dias
            deverão ser revisados e ter seu andamento atualizado no sistema.
          </p>
          <p>
            Essa medida foi implementada para garantir um melhor controle de qualidade, organização
            e acompanhamento dos atendimentos, evitando que qualquer cliente fique sem o devido
            acompanhamento.
          </p>
          <p>
            Contamos com a colaboração de toda a equipe para manter as informações sempre atualizadas.
          </p>
          <p className="font-medium text-foreground">
            Em caso de dúvidas sobre o procedimento, procure a administração.
          </p>
        </div>

        <button
          onClick={fechar}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
