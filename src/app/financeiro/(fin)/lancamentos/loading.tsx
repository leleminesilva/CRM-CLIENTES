import { Skeleton } from "@fin/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando lançamentos">
      <div className="flex items-end justify-between">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-52" />
      </div>
      <Skeleton className="h-[108px] w-full rounded-card" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid gap-px overflow-hidden rounded-card border border-line">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-none" />
        ))}
      </div>
    </div>
  );
}
