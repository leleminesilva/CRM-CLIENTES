import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@fin/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  /** Uma frase que diz o que fazer. */
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <span className="inline-flex size-11 items-center justify-center rounded-card border border-line bg-surface-sunken text-ink-2">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="grid max-w-sm gap-1">
        <p className="font-medium text-ink">{title}</p>
        {description ? <p className="text-[13px] leading-5 text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
