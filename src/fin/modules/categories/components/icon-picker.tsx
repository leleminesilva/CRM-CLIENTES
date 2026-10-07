"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "@fin/lib/cn";
import { CATEGORY_ICONS, CATEGORY_ICON_NAMES } from "../icons";

export function IconPicker({
  value,
  onChange,
  color,
  "aria-labelledby": labelledBy,
}: {
  value: string;
  onChange: (value: string) => void;
  color: string;
  "aria-labelledby"?: string;
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-card border border-line bg-surface p-1.5 sm:grid-cols-10"
    >
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICONS[name];
        return (
          <RadioGroup.Item
            key={name}
            value={name}
            aria-label={name}
            className={cn(
              "inline-flex aspect-square cursor-pointer items-center justify-center rounded-[6px] text-ink-2 transition-colors hover:bg-surface-sunken",
              "data-[state=checked]:text-ink data-[state=checked]:ring-2 data-[state=checked]:ring-ink",
            )}
            style={
              value === name
                ? { backgroundColor: `color-mix(in oklab, ${color} 16%, var(--surface))` }
                : undefined
            }
          >
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
