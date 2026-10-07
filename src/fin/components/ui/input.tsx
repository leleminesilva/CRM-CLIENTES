import * as React from "react";
import { cn } from "@fin/lib/cn";

export const inputClasses =
  "h-9 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-120 outline-none hover:border-ink-3 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-critical aria-invalid:ring-critical/15";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...props }, ref) {
    return (
      <input ref={ref} type={type} data-slot="input" className={cn(inputClasses, className)} {...props} />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(inputClasses, "h-auto min-h-20 resize-y py-2 leading-5", className)}
      {...props}
    />
  );
});
