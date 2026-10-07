"use client";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionError } from "./safe-action-types";

interface ActionResultLike {
  data?: unknown;
  serverError?: ActionError;
  validationErrors?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
}

/**
 * Trata o retorno de uma action: erros de campo vão para o formulário, erros de negócio viram toast.
 * Retorna true quando deu certo.
 */
export function handleActionResult<T extends FieldValues, O = T>(
  result: ActionResultLike | undefined,
  form?: UseFormReturn<T, unknown, O>,
): boolean {
  if (!result) {
    toast.error("Sem resposta do servidor. Verifique se o app está rodando e tente de novo.");
    return false;
  }
  if (result.serverError) {
    toast.error(result.serverError.message);
    return false;
  }
  const v = result.validationErrors;
  if (v) {
    let applied = false;
    if (form && v.fieldErrors) {
      for (const [field, messages] of Object.entries(v.fieldErrors)) {
        if (messages?.[0]) {
          form.setError(field as Path<T>, { type: "server", message: messages[0] });
          applied = true;
        }
      }
    }
    if (!applied) toast.error(v.formErrors?.[0] ?? "Revise os campos destacados.");
    return false;
  }
  return true;
}
