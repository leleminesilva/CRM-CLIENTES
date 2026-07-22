import { Recycle } from "lucide-react";

export default function SobrasMaterialPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <Recycle className="w-16 h-16 text-muted-foreground opacity-30" />
      <div>
        <h2 className="text-xl font-semibold">Sobras de Material</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
          Cadastro manual de sobras de alumínio e vidro pra reaproveitar em orçamentos futuros.
        </p>
      </div>
    </div>
  );
}
