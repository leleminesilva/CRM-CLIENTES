import type * as React from "react";
import { cn } from "@fin/lib/cn";

/** Superfície padrão: borda fina, sem sombra (DS §4). */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-card border border-line bg-surface", className)} {...props} />
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="grid gap-0.5">
        <h2 className="title-section">{title}</h2>
        {description ? <p className="text-[13px] leading-5 text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
