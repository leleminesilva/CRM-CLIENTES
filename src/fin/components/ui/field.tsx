"use client";

import * as React from "react";
import { cn } from "@fin/lib/cn";
import { Label } from "./label";

interface FieldProps {
  label: string;
  /** Texto de apoio sob o campo. */
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  /** Recebe o id e os atributos de acessibilidade a aplicar no controle. */
  children: (control: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
  /** Rótulo à direita (ex.: "opcional"). */
  aside?: React.ReactNode;
}

/** Rótulo + controle + dica/erro, com ids ligados para leitores de tela. */
export function Field({ label, hint, error, className, children, aside }: FieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside ? <span className="text-xs text-ink-3">{aside}</span> : null}
      </div>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={errorId} className="text-[13px] leading-4 text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-4 text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
