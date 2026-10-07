"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@fin/components/ui/alert-dialog";
import { Button } from "@fin/components/ui/button";
import { cn } from "@fin/lib/cn";
import type { EditScope } from "@fin/modules/recurrences/schemas";

const OPTIONS: { value: EditScope; label: string; hint: string }[] = [
  { value: "this", label: "Só este", hint: "As outras ocorrências continuam como estão." },
  {
    value: "future",
    label: "Este e os próximos",
    hint: "Vale daqui em diante; o histórico não muda.",
  },
  {
    value: "all-pending",
    label: "Todos os pendentes",
    hint: "Inclui pendentes anteriores; os já pagos não mudam.",
  },
];

/** Pergunta até onde aplicar uma mudança feita num lançamento recorrente. */
export function useScopeDialog() {
  const [state, setState] = React.useState<{
    resolve: (s: EditScope | null) => void;
    verb: string;
    allowed: EditScope[];
    title: string;
  } | null>(null);
  const [value, setValue] = React.useState<EditScope>("this");

  const ask = React.useCallback(
    (
      verb = "Aplicar alteração",
      allowed: EditScope[] = ["this", "future", "all-pending"],
      title = "Este lançamento se repete",
    ) =>
      new Promise<EditScope | null>((resolve) => {
        setValue("this");
        setState({ resolve, verb, allowed, title });
      }),
    [],
  );

  function close(result: EditScope | null) {
    state?.resolve(result);
    setState(null);
  }

  const dialog = (
    <AlertDialog open={Boolean(state)} onOpenChange={(open) => !open && close(null)}>
      <AlertDialogContent>
        <div className="grid gap-1.5">
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          <AlertDialogDescription>Aplicar a quais ocorrências?</AlertDialogDescription>
        </div>
        <RadioGroup.Root
          value={value}
          onValueChange={(v) => setValue(v as EditScope)}
          className="grid gap-2"
          aria-label="Escopo da alteração"
        >
          {OPTIONS.filter((o) => state?.allowed.includes(o.value)).map((o) => (
            <RadioGroup.Item
              key={o.value}
              value={o.value}
              className={cn(
                "grid cursor-pointer gap-0.5 rounded-card border border-line p-3 text-left transition-colors hover:border-ink-3",
                "data-[state=checked]:border-ink data-[state=checked]:bg-surface-sunken",
              )}
            >
              <span className="text-sm font-medium">{o.label}</span>
              <span className="text-xs text-ink-3">{o.hint}</span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel asChild>
            <Button variant="secondary">Cancelar</Button>
          </AlertDialogCancel>
          <Button onClick={() => close(value)}>{state?.verb ?? "Aplicar"}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
