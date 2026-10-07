"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@fin/components/ui/alert-dialog";
import { Button } from "@fin/components/ui/button";
import { Input } from "@fin/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Verbo exato da ação, ex.: "Excluir conta". */
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  destructive?: boolean;
  /** Ações irreversíveis: exige digitar este texto para liberar o botão. */
  typeToConfirm?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
  typeToConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const inputId = React.useId();
  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <div className="grid gap-1.5">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2 text-sm text-ink-2">{description}</div>
          </AlertDialogDescription>
        </div>
        {typeToConfirm !== undefined ? (
          <div className="grid gap-1.5">
            <label htmlFor={inputId} className="text-[13px] text-ink-2">
              Para confirmar, digite{" "}
              <strong className="font-semibold text-ink">{typeToConfirm}</strong>
            </label>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel asChild>
            <Button variant="secondary" disabled={pending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={blocked || pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
