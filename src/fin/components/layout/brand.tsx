import { cn } from "@fin/lib/cn";

/** Marca: a "régua" — duas barras de comprimentos diferentes, como a assinatura do painel. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-ink" />
      <rect x="7" y="11" width="18" height="3.5" rx="1.75" className="fill-on-ink" />
      <rect x="7" y="17.5" width="11" height="3.5" rx="1.75" className="fill-on-ink opacity-60" />
    </svg>
  );
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[15px] leading-5 font-semibold tracking-[-0.01em] [font-variation-settings:'wdth'_112]",
        className,
      )}
    >
      Controle de Gasto
    </span>
  );
}
