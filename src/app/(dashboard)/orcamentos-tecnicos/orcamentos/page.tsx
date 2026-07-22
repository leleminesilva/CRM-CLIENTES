import { FileText } from "lucide-react";

export default function OrcamentosPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <FileText className="w-16 h-16 text-muted-foreground opacity-30" />
      <div>
        <h2 className="text-xl font-semibold">Orçamentos</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
          O motor de cálculo (linha → produto → variante → dimensões) chega na próxima etapa.
        </p>
      </div>
    </div>
  );
}
