import { Wallet, Hammer } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function FinanceiroPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          Financeiro
        </h2>
        <p className="text-muted-foreground">Contas, faturamento e fluxo de caixa da Infinity Glass</p>
      </div>

      <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Hammer className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold">Módulo em construção</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          O módulo Financeiro ainda está sendo montado. Em breve as telas de contas a pagar/receber,
          faturamento e fluxo de caixa aparecem aqui.
        </p>
      </Card>
    </div>
  );
}
