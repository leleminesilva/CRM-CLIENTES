"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@fin/lib/cn";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex items-center gap-1 rounded-card bg-surface-sunken p-1", className)}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium text-ink-2 transition-colors duration-120 hover:text-ink",
        "data-[state=active]:bg-surface-raised data-[state=active]:text-ink data-[state=active]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]",
        className,
      )}
      {...props}
    />
  );
});
