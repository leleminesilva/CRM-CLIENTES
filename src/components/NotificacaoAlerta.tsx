"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Link from "next/link";

interface Notificacao {
  id: string;
  nome: string;
  notificacaoMensagem: string;
  notificacaoEm: string;
}

export function NotificacaoAlerta() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!user) return;
    axios.get("/api/notificacoes")
      .then(r => { if (r.data.data?.length) setLista(r.data.data); })
      .catch(() => {});
  }, [user]);

  if (!lista.length || idx >= lista.length) return null;

  const notif = lista[idx];

  function fechar() {
    axios.patch(`/api/clientes/${notif.id}/notificar`).catch(() => {});
    setIdx(i => i + 1);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">🔔</span>
          <div>
            <p className="text-xs text-amber-400 font-medium uppercase tracking-wide mb-0.5">Notificação do Sistema</p>
            <h2 className="text-lg font-bold text-foreground leading-tight">
              Cliente: {notif.nome}
            </h2>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {notif.notificacaoMensagem}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/clientes/${notif.id}`}
            onClick={fechar}
            className="flex-1 py-2.5 rounded-lg border border-border text-center text-sm font-semibold hover:bg-muted transition-colors"
          >
            Ver Cliente
          </Link>
          <button
            onClick={fechar}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            Entendido
          </button>
        </div>

        {lista.length > 1 && (
          <p className="text-center text-xs text-muted-foreground">
            {idx + 1} de {lista.length} notificações
          </p>
        )}
      </div>
    </div>
  );
}
