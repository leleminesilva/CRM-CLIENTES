import type { ErrorCode } from "./errors";

/** Erro de negócio devolvido pelas server actions (seguro para o navegador). */
export interface ActionError {
  code: ErrorCode;
  message: string;
}
