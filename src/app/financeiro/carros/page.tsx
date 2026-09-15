import { Car, Hammer } from "lucide-react";
import { Card } from "@/components/ui/card";

// Conteúdo ainda não definido — aguardando o usuário dizer o que precisa
// controlar aqui (cadastro dos carros, gastos por carro, manutenção, etc.).
export default function CarrosPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Car className="w-6 h-6" />
          Carros
        </h2>
        <p className="text-muted-foreground">Controle dos veículos da Infinity Glass</p>
      </div>

      <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Hammer className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold">Aba em construção</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Me diga o que precisa controlar aqui — cadastro dos carros, gastos por veículo
          (combustível, manutenção, seguro), quilometragem — que eu monto em cima.
        </p>
      </Card>
    </div>
  );
}
