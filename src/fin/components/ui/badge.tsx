import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@fin/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-line bg-surface-sunken text-ink-2",
        outline: "border-line-strong text-ink-2",
        ink: "border-transparent bg-ink text-on-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>
>(function Badge({ className, variant, ...props }, ref) {
  return (
    <span ref={ref} data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
});
