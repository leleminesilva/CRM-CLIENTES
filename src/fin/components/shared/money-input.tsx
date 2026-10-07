"use client";

import * as React from "react";
import { Input } from "@fin/components/ui/input";
import { cn } from "@fin/lib/cn";
import { parseMoneyInput } from "@fin/lib/money";

const display = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1234.5" (MoneyString) → "1.234,50" para preencher o campo. */
export function moneyToInput(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = parseMoneyInput(value);
  return parsed ? display.format(parsed.toNumber()).replace("-", "−") : value;
}

type MoneyInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type" | "inputMode">;

/** Campo de valor em reais: aceita "1.234,56", "1234.56", "250"; normaliza ao sair do campo. */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { className, onBlur, onChange, ...props },
  ref,
) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-3">
        R$
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn("pl-9 nums", className)}
        onChange={onChange}
        onBlur={(event) => {
          const parsed = parseMoneyInput(event.target.value);
          if (parsed) {
            const formatted = display.format(parsed.toNumber()).replace("-", "−");
            if (formatted !== event.target.value) {
              event.target.value = formatted;
              onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }
          onBlur?.(event);
        }}
        {...props}
      />
    </div>
  );
});
