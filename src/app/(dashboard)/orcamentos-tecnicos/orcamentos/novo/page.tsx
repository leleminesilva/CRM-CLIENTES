"use client";

import { OrcamentoForm } from "../OrcamentoForm";

export default function NovoOrcamentoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Novo orçamento</h2>
        <p className="text-sm text-muted-foreground">Adicione itens escolhendo linha → produto → variante → dimensões</p>
      </div>
      <OrcamentoForm mode="create" />
    </div>
  );
}
