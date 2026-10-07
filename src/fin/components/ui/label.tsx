"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "@fin/lib/cn";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn("text-[13px] leading-4 font-medium text-ink-2 select-none", className)}
      {...props}
    />
  );
});
