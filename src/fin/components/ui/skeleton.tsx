import type * as React from "react";
import { cn } from "@fin/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-control bg-surface-sunken", className)}
      {...props}
    />
  );
}
