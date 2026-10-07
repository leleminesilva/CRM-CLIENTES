"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type * as React from "react";
import { cn } from "@fin/lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  className?: string;
  "aria-label": string;
}

/** Controle segmentado (escolha única), ex.: Despesa | Receita | Transferência. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn("inline-flex items-center gap-1 rounded-card bg-surface-sunken p-1", className)}
      aria-label={aria["aria-label"]}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium whitespace-nowrap text-ink-2 transition-colors duration-120 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=on]:bg-surface-raised data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
