import { ClipboardCheck } from "lucide-react";

export default function OrdensServicoPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <ClipboardCheck className="w-16 h-16 text-muted-foreground opacity-30" />
      <div>
        <h2 className="text-xl font-semibold">Ordens de Serviço</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
          Nascem ao aprovar um orçamento. Chega depois do motor de cálculo estar pronto.
        </p>
      </div>
    </div>
  );
}
