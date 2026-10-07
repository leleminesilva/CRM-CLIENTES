"use client";

import { CheckIcon } from "lucide-react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "@fin/lib/cn";

interface ColorSwatchesProps {
  value: string | null;
  onChange: (value: string | null) => void;
  colors: readonly { hex: string; name: string }[];
  allowNone?: boolean;
  disabled?: boolean;
  "aria-labelledby"?: string;
}

export function ColorSwatches({
  value,
  onChange,
  colors,
  allowNone = false,
  disabled,
  ...aria
}: ColorSwatchesProps) {
  return (
    <RadioGroup.Root
      value={value ?? "none"}
      onValueChange={(v) => onChange(v === "none" ? null : v)}
      disabled={disabled}
      className="flex flex-wrap gap-2"
      aria-labelledby={aria["aria-labelledby"]}
    >
      {allowNone ? (
        <RadioGroup.Item
          value="none"
          aria-label="Sem cor"
          className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:ring-2 data-[state=checked]:ring-ink data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-surface-raised"
        >
          <span className="h-px w-4 rotate-45 bg-ink-3" />
        </RadioGroup.Item>
      ) : null}
      {colors.map((c) => (
        <RadioGroup.Item
          key={c.hex}
          value={c.hex}
          aria-label={c.name}
          title={c.name}
          className={cn(
            "relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full",
            "data-[state=checked]:ring-2 data-[state=checked]:ring-ink data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-surface-raised",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{ backgroundColor: c.hex }}
        >
          <RadioGroup.Indicator>
            <CheckIcon className="size-3.5 text-white mix-blend-difference" strokeWidth={3} />
          </RadioGroup.Indicator>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
