"use client";

import { useEffect, useState } from "react";

const ALERTA_KEY = "crm_alerta_sistema_v3";

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
      <div className="bg-card border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">⚠️</span>
          <h2 className="text-lg font-bold text-foreground leading-tight">
            Aviso Importante
          </h2>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3 text-sm text-foreground leading-relaxed">
          <p>
            Todos os valores referentes a vendas, compras, despesas e demais movimentações devem ser
            lançados no CRM em até <strong>24 horas</strong> após sua ocorrência.
          </p>
          <p>
            A atualização dentro desse prazo é obrigatória para garantir a confiabilidade das
            informações, o controle financeiro e o bom funcionamento dos processos da empresa.
          </p>
          <p className="font-semibold text-amber-500">
            Não será permitido atraso superior a 24 horas no lançamento dos valores.
          </p>
          <p>
            Em caso de dúvidas ou qualquer impedimento para realizar o lançamento, comunique
            imediatamente o responsável.
          </p>
        </div>

        <button
          onClick={fechar}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
