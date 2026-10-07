import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@fin/lib/cn";

// Portado de Financeiro/src/components/ui. Diferença: forwardRef (React 18 não repassa `ref`
// como prop), necessário para Radix (asChild) e react-hook-form.

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-120 ease-standard select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-ink text-on-ink hover:bg-ink/88 active:bg-ink/80",
        secondary:
          "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-surface-raised active:bg-surface-sunken",
        ghost: "text-ink-2 hover:bg-surface-sunken hover:text-ink",
        destructive: "bg-critical text-white hover:bg-critical/90 dark:text-[#1a0503]",
        link: "h-auto px-0 text-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
