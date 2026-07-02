"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ALERTA_KEY = "crm_alerta_sistema_v1";

export function AlertaSistema() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(ALERTA_KEY)) {
      setAberto(true);
    }
  }, []);

  function fechar() {
    localStorage.setItem(ALERTA_KEY, "visto");
    setAberto(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            🚨 Atualização Importante do Sistema
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3 text-sm text-muted-foreground leading-relaxed">
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
        <DialogFooter>
          <Button onClick={fechar} className="bg-indigo-600 hover:bg-indigo-700 w-full">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
