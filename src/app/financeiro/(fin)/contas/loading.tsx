import { Skeleton } from "@fin/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando contas">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[116px] w-full rounded-card" />
      <div className="grid gap-px overflow-hidden rounded-card border border-line">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[64px] rounded-none" />
        ))}
      </div>
    </div>
  );
}
